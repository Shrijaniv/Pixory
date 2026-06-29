"""
Pixory publish sidecar — runs on port 8001.
Accepts base64 photos from the Node.js backend and posts them to Instagram
via instagrapi (the Python library that actually works).

Dependencies: pip install -r requirements.txt

Start: python publish_sidecar.py
"""

import base64
import tempfile
from pathlib import Path
from typing import List

import imagehash
import numpy as np
import cv2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from instagrapi import Client

# Pluggable face engine (DeepFace or InsightFace), chosen per-request.
# The heavy ML libs are imported lazily inside each engine, so this import is cheap.
from face_engines import get_engine, DEFAULT_ENGINE

print(f"[sidecar] face engine default: {DEFAULT_ENGINE} (per-request override via face_engine)")

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def decode_b64_to_cv2(b64: str):
    """Decode a base64 JPEG string to an OpenCV BGR image array."""
    img_bytes = base64.b64decode(b64)
    nparr = np.frombuffer(img_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


# ── Session persistence ────────────────────────────────────────────────────────
SESSION_DIR = Path.home() / ".pixory" / "sessions"
SESSION_DIR.mkdir(parents=True, exist_ok=True)


def session_path(username: str) -> Path:
    return SESSION_DIR / f"{username}.json"


def load_session(cl: Client, username: str) -> bool:
    p = session_path(username)
    if p.exists():
        try:
            cl.load_settings(p)
            return True
        except Exception:
            pass
    return False


def save_session(cl: Client, username: str):
    try:
        cl.dump_settings(session_path(username))
    except Exception:
        pass


def clear_session(username: str):
    try:
        session_path(username).unlink(missing_ok=True)
    except Exception:
        pass


def get_logged_in_client(username: str, password: str) -> Client:
    cl = Client()
    cl.delay_range = [1, 3]  # human-like delays between requests

    if load_session(cl, username):
        try:
            cl.get_timeline_feed()  # lightweight check — raises if session dead
            return cl
        except Exception:
            clear_session(username)

    # Fresh login
    cl.login(username, password)
    save_session(cl, username)
    return cl


# ── Request / response models ─────────────────────────────────────────────────

class PublishRequest(BaseModel):
    photos_b64: list[str]
    caption: str
    username: str
    password: str
    location_lat: float | None = None
    location_lon: float | None = None
    location_name: str | None = None   # used as search hint when coords are absent


class PublishResult(BaseModel):
    success: bool
    post_id: str | None = None
    error: str | None = None


class AccountInfoRequest(BaseModel):
    username: str
    password: str


class AccountInfoResult(BaseModel):
    success: bool
    username: str | None = None
    full_name: str | None = None
    profile_pic_url: str | None = None
    error: str | None = None


class LocationItem(BaseModel):
    pk: str
    name: str
    lat: float | None = None
    lon: float | None = None


class LocationSearchResult(BaseModel):
    locations: list[LocationItem]


class LocationSearchRequest(BaseModel):
    username: str
    password: str
    lat: float | None = None
    lon: float | None = None
    name: str | None = None            # used when lat/lon not available


class ScorePhotoItem(BaseModel):
    index: int
    data_b64: str


class ScoreRequest(BaseModel):
    photos: List[ScorePhotoItem]
    face_engine: str | None = None   # 'deepface' | 'insightface' (None → server default)


class PhotoScore(BaseModel):
    index: int
    sharpness: float          # 0–1, Laplacian variance normalised [10, 500]
    face_count: int           # total faces detected
    happy_face_count: int     # faces with dominant emotion: happy or surprise
    brightness: float         # 0–1, mean luminance (0=black, 0.5=ideal, 1=blown)
    brightness_quality: float # 0–1, 1.0 at mean=0.5, falls to 0 at extremes
    contrast: float           # 0–1, std-dev of luminance normalised [0, 0.314]
    saturation: float         # 0–1, mean HSV saturation
    complexity: float         # 0–1, edge pixel density (low=clean, high=busy)
    shot_type: str            # 'closeup' | 'medium' | 'wide' — estimated from face bbox area
    subject_ratio: float      # largest face bbox area / frame area (0–1); 0 for no-face photos
    group_size: str           # 'none' | 'solo' | 'duo' | 'group' — derived from face_count
    phash: str | None = None  # perceptual hash hex string for near-duplicate detection


class ScoreResult(BaseModel):
    scores: List[PhotoScore]


class RegisterFaceRequest(BaseModel):
    photo_b64: str
    face_engine: str | None = None   # which engine produces the embedding


class RegisterFaceResult(BaseModel):
    success: bool
    embedding: list[float] | None = None
    engine: str | None = None        # engine that produced the embedding
    dim: int | None = None           # embedding dimensionality
    error: str | None = None


class MatchFaceItem(BaseModel):
    index: int
    data_b64: str


class MatchFaceRequest(BaseModel):
    reference_embedding: list[float]
    photos: list[MatchFaceItem]
    face_engine: str | None = None   # MUST match the engine that registered the reference
    threshold: float | None = None   # None → engine's default cosine cutoff


class MatchFaceResultItem(BaseModel):
    index: int
    user_face_present: bool
    similarity: float


class MatchFaceResult(BaseModel):
    matches: list[MatchFaceResultItem]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "publish-sidecar", "face_engine_default": DEFAULT_ENGINE}


@app.post("/search_location", response_model=LocationSearchResult)
def search_location(req: LocationSearchRequest):
    """
    Search Instagram locations using instagrapi.
    Requires valid Instagram credentials (used to call the Instagram API).
    Returns up to 10 matching locations ordered by proximity or relevance.
    """
    try:
        cl = get_logged_in_client(req.username, req.password)
        results = []

        if req.lat is not None and req.lon is not None:
            # Primary: search by GPS coordinates (most accurate)
            places = cl.location_search(req.lat, req.lon)
        elif req.name:
            # Fallback: text search by place name
            places = cl.fbsearch_places(req.name)
        else:
            return LocationSearchResult(locations=[])

        for p in places[:10]:
            lat_val = getattr(p, 'lat', None)
            lon_val = getattr(p, 'lng', None) or getattr(p, 'lon', None)
            results.append(LocationItem(
                pk=str(p.pk),
                name=str(p.name),
                lat=float(lat_val) if lat_val is not None else None,
                lon=float(lon_val) if lon_val is not None else None,
            ))

        return LocationSearchResult(locations=results)

    except Exception as e:
        print(f"[sidecar] search_location error: {e}")
        return LocationSearchResult(locations=[])


@app.post("/score_photos", response_model=ScoreResult)
def score_photos(req: ScoreRequest):
    """
    Score photos using the selected face engine (emotion-aware detection) + OpenCV signals.
    Per-photo errors return a neutral score so one bad image never fails the batch.
    """
    results: List[PhotoScore] = []
    try:
        engine = get_engine(req.face_engine)
    except Exception as e:
        # Engine not installed → score everything else, just without face signals.
        print(f"[sidecar] face engine '{req.face_engine}' unavailable — scoring without faces: {e}")
        engine = None

    for item in req.photos:
        try:
            img = decode_b64_to_cv2(item.data_b64)

            if img is None:
                results.append(PhotoScore(
                    index=item.index, sharpness=0.5, face_count=0, happy_face_count=0,
                    brightness=0.5, brightness_quality=0.5, contrast=0.5,
                    saturation=0.3, complexity=0.3,
                    shot_type='wide', subject_ratio=0.0, group_size='none', phash=None,
                ))
                continue

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Sharpness: Laplacian variance (>500 → 1.0, <10 → 0.0)
            lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharpness = float(min(max((lap_var - 10.0) / (500.0 - 10.0), 0.0), 1.0))

            # Face count + emotion + bounding boxes via the selected engine.
            # (DeepFace handles its own Haar fallback internally; InsightFace uses SCRFD.)
            if engine is not None:
                analysis = engine.analyze(img)
                face_count = analysis.count
                happy_face_count = analysis.happy_count
                face_bboxes = analysis.bboxes  # list of (x, y, w, h)
            else:
                face_count, happy_face_count, face_bboxes = 0, 0, []

            # ── Shot type estimation ──────────────────────────────────────
            img_area = img.shape[0] * img.shape[1]
            subject_ratio = 0.0
            shot_type = 'wide'
            if face_bboxes:
                largest_face_area = max(w * h for (_, _, w, h) in face_bboxes)
                subject_ratio = float(largest_face_area / img_area)
                if subject_ratio > 0.15:
                    shot_type = 'closeup'   # face dominates the frame
                elif subject_ratio > 0.04:
                    shot_type = 'medium'    # person visible with scene context
                # else: 'wide' — person tiny or face very small in frame
            else:
                # No faces — estimate via center-crop edge density as a subject-size proxy
                hh, ww = gray.shape
                center = gray[hh // 3: 2 * hh // 3, ww // 3: 2 * ww // 3]
                center_edges = cv2.Canny(center, 50, 150)
                full_edges   = cv2.Canny(gray, 50, 150)
                center_density = (center_edges > 0).sum() / (center_edges.size + 1)
                full_density   = (full_edges   > 0).sum() / (full_edges.size   + 1)
                edge_ratio = center_density / (full_density + 1e-6)
                if edge_ratio > 1.5:
                    shot_type = 'medium'   # subject concentrated in center
                subject_ratio = float(min(edge_ratio / 3.0, 1.0))

            # ── Group size ────────────────────────────────────────────────
            if face_count == 0:
                group_size = 'none'
            elif face_count == 1:
                group_size = 'solo'
            elif face_count == 2:
                group_size = 'duo'
            else:
                group_size = 'group'

            # ── Additional signals (one pass, all from gray + HSV) ──────────
            gray_f = gray.astype(np.float32) / 255.0

            # Brightness: mean luminance
            brightness = float(gray_f.mean())
            # brightness_quality: 1.0 at mean=0.5, falls to 0 at 0 and 1
            brightness_quality = float(1.0 - abs(brightness - 0.5) * 2.0)

            # Contrast: std-dev of luminance (max possible std of [0,1] ≈ 0.5)
            contrast = float(min(gray_f.std() / 0.5, 1.0))

            # Saturation: mean HSV S channel (0–255 → 0–1)
            hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
            saturation = float(hsv[:, :, 1].mean() / 255.0)

            # Complexity: Canny edge density (fraction of pixels that are edges)
            edges = cv2.Canny(gray, 50, 150)
            complexity = float((edges > 0).sum() / edges.size)

            # Perceptual hash — ported from instagram_sorter/app/core/deduplicator.py
            phash_str: str | None = None
            try:
                pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
                pil_img.thumbnail((512, 512))
                phash_str = str(imagehash.phash(pil_img))
            except Exception:
                pass

            results.append(PhotoScore(
                index=item.index,
                sharpness=sharpness,
                face_count=face_count,
                happy_face_count=happy_face_count,
                brightness=brightness,
                brightness_quality=brightness_quality,
                contrast=contrast,
                saturation=saturation,
                complexity=complexity,
                shot_type=shot_type,
                subject_ratio=subject_ratio,
                group_size=group_size,
                phash=phash_str,
            ))

        except Exception as e:
            # Return neutral score on any error — don't fail the whole batch
            print(f"[sidecar] score_photos error for index {item.index}: {e}")
            results.append(PhotoScore(
                index=item.index, sharpness=0.5, face_count=0, happy_face_count=0,
                brightness=0.5, brightness_quality=0.5, contrast=0.5,
                saturation=0.3, complexity=0.3,
                shot_type='wide', subject_ratio=0.0, group_size='none', phash=None,
            ))

    return ScoreResult(scores=results)


@app.post("/register_face", response_model=RegisterFaceResult)
def register_face(req: RegisterFaceRequest):
    """
    Extract a face embedding from a reference photo.
    Called once during "Who Are You?" setup. Returns a Facenet128 embedding vector
    that the app stores locally and uses for per-curation face matching.

    Fallback chain: MTCNN strict → MTCNN permissive → opencv permissive.
    MTCNN's strict mode rejects faces below its internal confidence threshold
    even when a face is clearly visible, so we retry with looser settings
    before giving up.
    """
    img = decode_b64_to_cv2(req.photo_b64)
    if img is None:
        return RegisterFaceResult(success=False, error="Could not decode image")

    try:
        engine = get_engine(req.face_engine)
    except Exception as e:
        return RegisterFaceResult(success=False, engine=req.face_engine, error=f"Face engine unavailable: {e}")
    try:
        embedding = engine.embed_reference(img)
    except Exception as e:
        print(f"[sidecar] register_face ({engine.name}) error: {e}")
        embedding = None

    if embedding:
        print(f"[sidecar] register_face: OK (engine={engine.name}, dims={len(embedding)})")
        return RegisterFaceResult(success=True, embedding=embedding, engine=engine.name, dim=len(embedding))

    return RegisterFaceResult(
        success=False,
        engine=engine.name,
        error="No face detected — try a clearer, well-lit photo where your face is fully visible and centred",
    )


@app.post("/match_faces", response_model=MatchFaceResult)
def match_faces(req: MatchFaceRequest):
    """
    Compare a reference embedding against a batch of candidate photos.
    Returns per-photo similarity scores and whether the user's face is present.
    Only called for photos where face_count > 0 (already determined by score_photos).
    """
    try:
        engine = get_engine(req.face_engine)
    except Exception as e:
        # Engine unavailable → fail-open (don't drop anyone's photos).
        print(f"[sidecar] match_faces engine '{req.face_engine}' unavailable — failing open: {e}")
        return MatchFaceResult(matches=[
            MatchFaceResultItem(index=p.index, user_face_present=True, similarity=0.5) for p in req.photos
        ])
    threshold = req.threshold if req.threshold is not None else engine.match_threshold
    ref = np.array(req.reference_embedding)
    ref_norm = np.linalg.norm(ref)
    results = []

    for photo in req.photos:
        try:
            img = decode_b64_to_cv2(photo.data_b64)
            if img is None:
                # Fail-open: assume user is present so we don't wrongly drop the photo
                results.append(MatchFaceResultItem(index=photo.index, user_face_present=True, similarity=0.5))
                continue

            # Every face's embedding from the selected engine (empty for no-face crops)
            representations = engine.embed_all(img)

            if not representations:
                # No face found at embedding stage — don't filter the photo out
                results.append(MatchFaceResultItem(index=photo.index, user_face_present=True, similarity=0.0))
                continue

            # Find the best (highest cosine similarity) face in the photo
            best_sim = 0.0
            for cand_vec in representations:
                cand = np.array(cand_vec)
                cand_norm = np.linalg.norm(cand)
                if cand_norm == 0:
                    continue
                sim = float(np.dot(ref, cand) / (ref_norm * cand_norm))
                best_sim = max(best_sim, sim)

            user_face_present = best_sim >= threshold
            results.append(MatchFaceResultItem(
                index=photo.index,
                user_face_present=user_face_present,
                similarity=best_sim,
            ))

        except Exception as e:
            print(f"[sidecar] match_faces error for index {photo.index}: {e}")
            # Fail-open on any per-photo error
            results.append(MatchFaceResultItem(index=photo.index, user_face_present=True, similarity=0.5))

    return MatchFaceResult(matches=results)


@app.post("/account_info", response_model=AccountInfoResult)
def account_info(req: AccountInfoRequest):
    """
    Return the logged-in user's profile: full name, username, and avatar URL.
    Used to auto-fill the app's Profile screen after connecting Instagram.
    """
    try:
        cl = get_logged_in_client(req.username, req.password)
        info = cl.account_info()
        return AccountInfoResult(
            success=True,
            username=info.username,
            full_name=info.full_name or None,
            profile_pic_url=str(info.profile_pic_url) if info.profile_pic_url else None,
        )
    except Exception as e:
        print(f"[sidecar] account_info error: {e}")
        return AccountInfoResult(success=False, error=str(e))


@app.post("/publish", response_model=PublishResult)
def publish(req: PublishRequest):
    tmp_paths: list[Path] = []
    try:
        # Decode base64 → temp JPEG files
        for i, b64 in enumerate(req.photos_b64):
            data = base64.b64decode(b64)
            tmp = tempfile.NamedTemporaryFile(suffix=f"_pixory_{i}.jpg", delete=False)
            tmp.write(data)
            tmp.close()
            tmp_paths.append(Path(tmp.name))

        cl = get_logged_in_client(req.username, req.password)

        # Resolve Instagram location if coordinates or name provided
        location = None
        if req.location_lat is not None and req.location_lon is not None:
            try:
                places = cl.location_search(req.location_lat, req.location_lon)
                if places:
                    location = places[0]
                    print(f"[sidecar] location resolved: {location.name} (pk={location.pk})")
            except Exception as loc_err:
                print(f"[sidecar] location_search failed (non-fatal): {loc_err}")
        elif req.location_name:
            try:
                places = cl.fbsearch_places(req.location_name)
                if places:
                    location = places[0]
                    print(f"[sidecar] location resolved via name: {location.name} (pk={location.pk})")
            except Exception as loc_err:
                print(f"[sidecar] fbsearch_places failed (non-fatal): {loc_err}")

        if len(tmp_paths) == 1:
            media = cl.photo_upload(tmp_paths[0], req.caption, location=location)
        else:
            media = cl.album_upload(tmp_paths, req.caption, location=location)

        return PublishResult(success=True, post_id=str(media.pk))

    except Exception as e:
        msg = str(e)
        # Clear session on auth errors so next attempt does fresh login
        if "login_required" in msg.lower() or "challenge_required" in msg.lower() or "checkpoint" in msg.lower():
            clear_session(req.username)
        return PublishResult(success=False, error=msg)

    finally:
        for p in tmp_paths:
            try:
                p.unlink()
            except Exception:
                pass


@app.delete("/session/{username}")
def delete_session(username: str):
    clear_session(username)
    return {"success": True}


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
