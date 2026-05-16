"""
FastAPI backend for PhotoSort.
Run: uvicorn server:app --reload --port 8000
"""

import asyncio
import io
import json
import sys
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

# Register HEIC support
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

app = FastAPI(title="PhotoSort API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store  {job_id: {"status": ..., "events": [], "result": ...}}
_jobs: dict[str, dict] = {}


# ── Request / Response models ─────────────────────────────────────────────────

class CurateRequest(BaseModel):
    folder: str
    method: str = "classic"          # classic | agent | openai_agent
    date_from: Optional[str] = None  # YYYY-MM-DD
    date_to: Optional[str] = None    # YYYY-MM-DD
    vibe: Optional[str] = None


class PublishRequest(BaseModel):
    photo_paths: list[str]
    caption: str
    username: str
    password: str


class CurateDeviceRequest(BaseModel):
    """Mobile curation: photos sent as base64 from the device."""
    photos_b64: list[str]        # base64-encoded JPEG for each candidate photo
    photo_names: list[str]       # filenames for display in prompt
    vibe: Optional[str] = None
    max_select: int = 20
    provider: str = "claude"     # claude | openai


class PublishFromDeviceRequest(BaseModel):
    """Mobile publish: photos sent as base64 strings from the device."""
    photos_b64: list[str]   # base64-encoded JPEG data for each photo
    caption: str
    username: str
    password: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/curate")
async def start_curate(req: CurateRequest):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "running", "events": [], "result": None}
    asyncio.create_task(_run_pipeline(job_id, req))
    return {"job_id": job_id}


@app.get("/api/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    """Server-Sent Events stream for pipeline progress."""
    async def event_generator():
        seen = 0
        while True:
            job = _jobs.get(job_id)
            if not job:
                yield _sse({"type": "error", "message": "Job not found"})
                return

            events = job["events"]
            while seen < len(events):
                yield _sse(events[seen])
                seen += 1

            if job["status"] == "done":
                yield _sse({"type": "done", "result": job["result"]})
                return
            if job["status"] == "error":
                yield _sse({"type": "error", "message": job.get("error", "Unknown error")})
                return

            await asyncio.sleep(0.2)

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/photo/thumbnail")
async def get_thumbnail(path: str = Query(...), size: int = 400):
    """Return a JPEG thumbnail for any photo path (including HEIC)."""
    from PIL import Image
    try:
        with Image.open(path) as img:
            img.thumbnail((size, size))
            img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            return Response(content=buf.getvalue(), media_type="image/jpeg")
    except Exception as e:
        return Response(content=str(e), status_code=500)


@app.post("/api/curate_device_photos")
async def curate_device_photos(req: CurateDeviceRequest):
    """
    Receive base64 photos from the mobile app, call Claude or OpenAI using
    the server's own API keys from .env, and return selected indices + captions.
    """
    import base64
    import tempfile
    from app.config.settings import ANTHROPIC_API_KEY, OPENAI_API_KEY

    if req.provider == "claude" and not ANTHROPIC_API_KEY:
        return {"success": False, "error": "ANTHROPIC_API_KEY not set in .env"}
    if req.provider == "openai" and not OPENAI_API_KEY:
        return {"success": False, "error": "OPENAI_API_KEY not set in .env"}

    # Decode photos and save to temp files
    tmp_paths: list[str] = []
    try:
        for i, b64 in enumerate(req.photos_b64):
            data = base64.b64decode(b64)
            tmp = tempfile.NamedTemporaryFile(suffix=f"_{i}.jpg", delete=False)
            tmp.write(data)
            tmp.close()
            tmp_paths.append(tmp.name)

        if req.provider == "claude":
            from app.services.claude_service import ClaudeService
            from app.core.agent_pipeline import run_agent_pipeline
            # Build a temp folder reference — agent will view the files directly
            service = ClaudeService(api_key=ANTHROPIC_API_KEY)
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: _curate_files_with_claude(tmp_paths, req.photo_names, service, req.vibe, req.max_select)
            )
        else:
            from app.services.openai_service import OpenAIService
            service = OpenAIService(api_key=OPENAI_API_KEY)
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: _curate_files_with_openai(tmp_paths, req.photo_names, service, req.vibe, req.max_select)
            )

        return {"success": True, **result}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        import os
        for p in tmp_paths:
            try:
                os.unlink(p)
            except Exception:
                pass


def _curate_files_with_claude(tmp_paths, photo_names, service, vibe, max_select):
    """Call Claude vision API with temp photo files, return curation result."""
    import base64
    from PIL import Image

    content = []
    for i, path in enumerate(tmp_paths):
        # Resize for API efficiency
        buf = io.BytesIO()
        with Image.open(path) as img:
            img.thumbnail((1024, 1024))
            img.convert("RGB").save(buf, format="JPEG", quality=80)
        b64 = base64.standard_b64encode(buf.getvalue()).decode()
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}})
        content.append({"type": "text", "text": f"Photo {i}: {photo_names[i] if i < len(photo_names) else path}"})

    vibe_text = f'\n\nVibe/theme: "{vibe}".' if vibe else ""
    content.append({"type": "text", "text": f"""You are a professional Instagram curator. You have been shown {len(tmp_paths)} photos.{vibe_text}

Select the best {min(max_select, len(tmp_paths))} photos for an Instagram carousel. Consider sharpness, exposure, composition, variety, and storytelling.

Respond with valid JSON only:
{{"selected_indices": [0, 2, ...], "notes": "...", "captions": [{{"mood": "wanderlust", "text": "...", "hashtags": [...]}}, {{"mood": "minimal", "text": "...", "hashtags": [...]}}, {{"mood": "story", "text": "...", "hashtags": [...]}}, {{"mood": "playful", "text": "...", "hashtags": [...]}}]}}"""})

    response = service.client.messages.create(
        model="claude-opus-4-5",
        max_tokens=2048,
        messages=[{"role": "user", "content": content}]
    )
    import json
    parsed = json.loads(response.content[0].text)
    return {
        "selected_indices": parsed.get("selected_indices", []),
        "captions": parsed.get("captions", []),
        "notes": parsed.get("notes", ""),
    }


def _curate_files_with_openai(tmp_paths, photo_names, service, vibe, max_select):
    """Call GPT-4o vision API with temp photo files, return curation result."""
    import base64
    from PIL import Image

    image_content = []
    for i, path in enumerate(tmp_paths):
        buf = io.BytesIO()
        with Image.open(path) as img:
            img.thumbnail((1024, 1024))
            img.convert("RGB").save(buf, format="JPEG", quality=80)
        b64 = base64.standard_b64encode(buf.getvalue()).decode()
        image_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"}})

    vibe_text = f'\n\nVibe/theme: "{vibe}".' if vibe else ""
    image_content.append({"type": "text", "text": f"""You are a professional Instagram curator. {len(tmp_paths)} photos shown.{vibe_text}
Select best {min(max_select, len(tmp_paths))}. Respond JSON only:
{{"selected_indices": [...], "notes": "...", "captions": [{{"mood": "wanderlust", "text": "...", "hashtags": [...]}}, {{"mood": "minimal", "text": "...", "hashtags": [...]}}, {{"mood": "story", "text": "...", "hashtags": [...]}}, {{"mood": "playful", "text": "...", "hashtags": [...]}}]}}"""})

    response = service.client.chat.completions.create(
        model="gpt-4o",
        max_tokens=2048,
        messages=[{"role": "user", "content": image_content}]
    )
    import json
    parsed = json.loads(response.choices[0].message.content)
    return {
        "selected_indices": parsed.get("selected_indices", []),
        "captions": parsed.get("captions", []),
        "notes": parsed.get("notes", ""),
    }


@app.post("/api/publish")
async def publish(req: PublishRequest):
    from app.models.photo import Photo
    from app.models.caption import Caption
    from app.services.instagram_service import InstagramService

    try:
        photos = [Photo(path=Path(p)) for p in req.photo_paths]
        caption = Caption(mood="custom", text=req.caption, hashtags=[])
        service = InstagramService(mode="instagrapi")
        service.login(req.username, req.password)
        post_id = service.publish_carousel(photos, caption)
        return {"success": True, "post_id": post_id}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/publish_from_device")
async def publish_from_device(req: PublishFromDeviceRequest):
    """Accept base64 photos from mobile, save to temp files, post via instagrapi."""
    import base64
    import tempfile
    from app.models.photo import Photo
    from app.models.caption import Caption
    from app.services.instagram_service import InstagramService

    tmp_paths: list[Path] = []
    try:
        # Decode and save each photo to a temp JPEG
        for i, b64 in enumerate(req.photos_b64):
            data = base64.b64decode(b64)
            tmp = tempfile.NamedTemporaryFile(suffix=f"_{i}.jpg", delete=False)
            tmp.write(data)
            tmp.close()
            tmp_paths.append(Path(tmp.name))

        photos = [Photo(path=p) for p in tmp_paths]
        caption = Caption(mood="custom", text=req.caption, hashtags=[])
        service = InstagramService(mode="instagrapi")
        service.login(req.username, req.password)
        post_id = service.publish_carousel(photos, caption)
        return {"success": True, "post_id": post_id}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        # Clean up temp files
        for p in tmp_paths:
            try:
                p.unlink()
            except Exception:
                pass


@app.get("/api/drafts")
async def get_drafts():
    from app.storage.database import Database
    with Database() as db:
        rows = db.conn.execute(
            "SELECT id, status, created_at, caption_text FROM drafts ORDER BY created_at DESC LIMIT 50"
        ).fetchall()
    return [{"id": r[0], "status": r[1], "created_at": r[2], "caption": r[3]} for r in rows]


# ── Pipeline runner (background task) ─────────────────────────────────────────

async def _run_pipeline(job_id: str, req: CurateRequest):
    job = _jobs[job_id]

    def push(event: dict):
        job["events"].append(event)

    def on_progress(msg: str):
        push({"type": "progress", "message": msg})

    loop = asyncio.get_event_loop()

    try:
        if req.method == "agent":
            from app.core.agent_pipeline import run_agent_pipeline
            from app.services.claude_service import ClaudeService
            from app.config.settings import ANTHROPIC_API_KEY

            if not ANTHROPIC_API_KEY:
                raise ValueError("ANTHROPIC_API_KEY not set in .env")

            push({"type": "progress", "message": "Claude is analyzing your photos..."})
            service = ClaudeService(api_key=ANTHROPIC_API_KEY)

            result = await loop.run_in_executor(None, lambda: run_agent_pipeline(
                folder=req.folder,
                claude_service=service,
                on_thinking=lambda t: push({"type": "thinking", "message": t[:300]}),
                on_progress=on_progress,
                date_from=req.date_from,
                date_to=req.date_to,
                vibe=req.vibe,
            ))

        elif req.method == "openai_agent":
            from app.core.openai_agent_pipeline import run_openai_agent_pipeline
            from app.services.openai_service import OpenAIService
            from app.config.settings import OPENAI_API_KEY

            if not OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY not set in .env")

            push({"type": "progress", "message": "GPT-4o is analyzing your photos..."})
            service = OpenAIService(api_key=OPENAI_API_KEY)

            result = await loop.run_in_executor(None, lambda: run_openai_agent_pipeline(
                folder=req.folder,
                openai_service=service,
                on_thinking=lambda t: push({"type": "thinking", "message": t[:300]}),
                on_progress=on_progress,
                date_from=req.date_from,
                date_to=req.date_to,
                vibe=req.vibe,
            ))

        else:
            result = await loop.run_in_executor(None, lambda: _run_classic(req, on_progress))

        job["result"] = {
            "selected": [str(p.path) for p in result.selected],
            "captions": [
                {"mood": c.mood, "text": c.text, "hashtags": c.hashtags}
                for c in result.captions
            ],
            "curation_notes": getattr(result, "curation_notes", ""),
        }
        job["status"] = "done"

    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)


def _run_classic(req: CurateRequest, on_progress):
    from datetime import datetime
    from app.core.gallery_scanner import scan_gallery
    from app.core.deduplicator import remove_duplicates
    from app.core.location_clusterer import cluster_photos
    from app.core.photo_scorer import score_photos
    from app.core.photo_selector import select_photos
    from app.core.agent_pipeline import AgentPipelineResult
    from app.models.caption import Caption

    on_progress("Scanning gallery...")
    photos = scan_gallery(req.folder)

    if req.date_from or req.date_to:
        dt_from = datetime.strptime(req.date_from, "%Y-%m-%d") if req.date_from else None
        dt_to = datetime.strptime(req.date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59) if req.date_to else None
        photos = [p for p in photos
                  if (dt_from is None or (p.date and p.date >= dt_from))
                  and (dt_to is None or (p.date and p.date <= dt_to))]

    on_progress(f"Found {len(photos)} photos — deduplicating...")
    photos = remove_duplicates(photos)

    on_progress("Clustering by location...")
    photos, _ = cluster_photos(photos)

    on_progress("Scoring photo quality...")
    photos = score_photos(photos)

    on_progress("Selecting best photos...")
    selected = select_photos(photos)

    # No captions in classic mode — Expo app will request them separately
    return AgentPipelineResult(selected=selected, captions=[], notes="")


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
