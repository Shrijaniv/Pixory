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

import numpy as np
import cv2
from deepface import DeepFace
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from instagrapi import Client

# Face detection backend for DeepFace.
# mtcnn: better than opencv (handles angles, partial faces, groups)
# retinaface: most accurate but slower — good if GPU available
# opencv: fastest, least accurate — use for testing only
DEEPFACE_BACKEND = 'mtcnn'

# Haar cascade kept as a per-photo fallback inside score_photos when
# DeepFace fails on a specific image (corrupted, extreme lighting, etc.)
_face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

print(f"[sidecar] DeepFace loaded — face identity filtering available (backend: {DEEPFACE_BACKEND})")

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


class ScoreResult(BaseModel):
    scores: List[PhotoScore]


class RegisterFaceRequest(BaseModel):
    photo_b64: str


class RegisterFaceResult(BaseModel):
    success: bool
    embedding: list[float] | None = None
    error: str | None = None


class MatchFaceItem(BaseModel):
    index: int
    data_b64: str


class MatchFaceRequest(BaseModel):
    reference_embedding: list[float]
    photos: list[MatchFaceItem]
    threshold: float = 0.6   # cosine similarity cutoff (Facenet128 default)


class MatchFaceResultItem(BaseModel):
    index: int
    user_face_present: bool
    similarity: float


class MatchFaceResult(BaseModel):
    matches: list[MatchFaceResultItem]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "publish-sidecar", "deepface": True, "backend": DEEPFACE_BACKEND}


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
    Score photos using DeepFace (emotion-aware face detection) + OpenCV signals.
    Per-photo errors fall back to Haar cascade so one bad image never fails the batch.
    """
    results: List[PhotoScore] = []
    _HAPPY_EMOTIONS = {'happy', 'surprise'}

    for item in req.photos:
        try:
            img = decode_b64_to_cv2(item.data_b64)

            if img is None:
                results.append(PhotoScore(
                    index=item.index, sharpness=0.5, face_count=0, happy_face_count=0,
                    brightness=0.5, brightness_quality=0.5, contrast=0.5,
                    saturation=0.3, complexity=0.3,
                ))
                continue

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            # Sharpness: Laplacian variance (>500 → 1.0, <10 → 0.0)
            lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            sharpness = float(min(max((lap_var - 10.0) / (500.0 - 10.0), 0.0), 1.0))

            # Face count + emotion detection via DeepFace
            # enforce_detection=False returns empty list for no-face photos (landscapes, food)
            face_count = 0
            happy_face_count = 0
            try:
                face_results = DeepFace.analyze(
                    img,
                    actions=['emotion'],
                    detector_backend=DEEPFACE_BACKEND,
                    enforce_detection=False,
                    silent=True,
                )
                if isinstance(face_results, dict):
                    face_results = [face_results]
                face_count = len(face_results)
                happy_face_count = sum(
                    1 for f in face_results
                    if f.get('dominant_emotion', '') in _HAPPY_EMOTIONS
                )
            except Exception:
                # Per-photo fallback to Haar cascade (corrupted image, extreme lighting, etc.)
                detected = _face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
                face_count = len(detected)
                happy_face_count = 0

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
            ))

        except Exception as e:
            # Return neutral score on any error — don't fail the whole batch
            print(f"[sidecar] score_photos error for index {item.index}: {e}")
            results.append(PhotoScore(
                index=item.index, sharpness=0.5, face_count=0, happy_face_count=0,
                brightness=0.5, brightness_quality=0.5, contrast=0.5,
                saturation=0.3, complexity=0.3,
            ))

    return ScoreResult(scores=results)


@app.post("/register_face", response_model=RegisterFaceResult)
def register_face(req: RegisterFaceRequest):
    """
    Extract a face embedding from a reference photo.
    Called once during "Who Are You?" setup. Returns a Facenet128 embedding vector
    that the app stores locally and uses for per-curation face matching.
    """
    try:
        img = decode_b64_to_cv2(req.photo_b64)
        if img is None:
            return RegisterFaceResult(success=False, error="Could not decode image")
        result = DeepFace.represent(
            img,
            model_name='Facenet',
            enforce_detection=True,   # Raise if no face found
            detector_backend=DEEPFACE_BACKEND,
        )
        embedding = result[0]['embedding']
        print(f"[sidecar] register_face: embedding extracted ({len(embedding)} dims)")
        return RegisterFaceResult(success=True, embedding=embedding)
    except Exception as e:
        err_msg = str(e)
        print(f"[sidecar] register_face error: {err_msg}")
        if "face" in err_msg.lower() or "detect" in err_msg.lower():
            return RegisterFaceResult(
                success=False,
                error="No face detected — try a clearer, well-lit photo where your face is fully visible"
            )
        return RegisterFaceResult(success=False, error=err_msg)


@app.post("/match_faces", response_model=MatchFaceResult)
def match_faces(req: MatchFaceRequest):
    """
    Compare a reference embedding against a batch of candidate photos.
    Returns per-photo similarity scores and whether the user's face is present.
    Only called for photos where face_count > 0 (already determined by score_photos).
    """
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

            # enforce_detection=False: returns empty list for no-face crops rather than raising
            representations = DeepFace.represent(
                img,
                model_name='Facenet',
                enforce_detection=False,
                detector_backend=DEEPFACE_BACKEND,
            )

            if not representations:
                # No face found at embedding stage — don't filter the photo out
                results.append(MatchFaceResultItem(index=photo.index, user_face_present=True, similarity=0.0))
                continue

            # Find the best (highest cosine similarity) face in the photo
            best_sim = 0.0
            for rep in representations:
                cand = np.array(rep['embedding'])
                cand_norm = np.linalg.norm(cand)
                if cand_norm == 0:
                    continue
                sim = float(np.dot(ref, cand) / (ref_norm * cand_norm))
                best_sim = max(best_sim, sim)

            user_face_present = best_sim >= req.threshold
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
