"""
DeepFace engine — the existing behavior, unchanged, behind the FaceEngine
interface. Detection + emotion via DeepFace.analyze (MTCNN); recognition via
DeepFace.represent (Facenet 128-d). TensorFlow is imported lazily here so the
InsightFace-only deploy never loads it.
"""
from __future__ import annotations

from typing import List, Optional

import cv2

from .base import BBox, FaceAnalysis

# Detection backend for DeepFace (mtcnn handles angles/partial faces/groups).
DEEPFACE_BACKEND = 'mtcnn'
_HAPPY_EMOTIONS = {'happy', 'surprise'}

# Minimum detector confidence for a region to count as a face.
MIN_FACE_CONFIDENCE = 0.5

# A "face" covering nearly the whole frame is DeepFace's no-face sentinel, not
# a detection. See _is_real_face.
WHOLE_FRAME_RATIO = 0.95


def _is_real_face(region: dict, img_shape) -> bool:
    """
    Reject DeepFace's synthetic whole-frame region (audit F3).

    With ``enforce_detection=False`` — which the scoring path must use, since a
    landscape legitimately has no face — DeepFace does not return an empty list
    when it finds nothing. It returns one entry whose region is the entire
    image and whose ``face_confidence`` is 0. Taking ``len(results)`` as the
    face count therefore reports exactly one face for every photo on earth.

    Verified against 8 real landscape photos: all 8 reported a face before this
    guard, none after.
    """
    w, h = region.get('w', 0), region.get('h', 0)
    if w <= 0 or h <= 0:
        return False

    # Newer DeepFace exposes a confidence. When present it is authoritative and
    # the geometry heuristic below is skipped entirely — a real close-up selfie
    # legitimately fills the frame, and rejecting it on size would break the
    # single most common kind of reference photo.
    confidence = region.get('face_confidence')
    if confidence is not None:
        return confidence >= MIN_FACE_CONFIDENCE

    # Older builds omit it, so fall back to the geometry of the sentinel: a
    # region covering essentially the whole frame is the no-face marker.
    img_h, img_w = img_shape[0], img_shape[1]
    if img_w > 0 and img_h > 0:
        if w >= img_w * WHOLE_FRAME_RATIO and h >= img_h * WHOLE_FRAME_RATIO:
            return False

    return True


class DeepFaceEngine:
    name = 'deepface'
    embedding_dim = 128
    match_threshold = 0.45  # Facenet cosine cutoff (preserves current behavior)

    def __init__(self):
        # Lazy heavy import — pulls in TensorFlow only when this engine is built.
        from deepface import DeepFace
        self._df = DeepFace
        self._face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        print('[face] DeepFace engine loaded (Facenet 128-d, mtcnn)')

    def analyze(self, img_bgr) -> FaceAnalysis:
        """Detection + emotion + bboxes. Per-photo Haar fallback on failure."""
        try:
            results = self._df.analyze(
                img_bgr,
                actions=['emotion'],
                detector_backend=DEEPFACE_BACKEND,
                enforce_detection=False,
                silent=True,
            )
            if isinstance(results, dict):
                results = [results]

            # Only regions that pass _is_real_face count. Previously this used
            # len(results), which counted the no-face sentinel (audit F3).
            real = []
            for f in results:
                region = dict(f.get('region', {}))
                # face_confidence sits alongside region on some versions.
                if 'face_confidence' in f and 'face_confidence' not in region:
                    region['face_confidence'] = f['face_confidence']
                if _is_real_face(region, img_bgr.shape):
                    real.append((f, region))

            bboxes: List[BBox] = [
                (r.get('x', 0), r.get('y', 0), r.get('w', 0), r.get('h', 0)) for _, r in real
            ]
            happy = sum(1 for f, _ in real if f.get('dominant_emotion', '') in _HAPPY_EMOTIONS)
            return FaceAnalysis(count=len(real), happy_count=happy, bboxes=bboxes)
        except Exception:
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
            detected = self._face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
            bboxes = [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in detected]
            return FaceAnalysis(count=len(detected), happy_count=0, bboxes=bboxes)

    def embed_reference(self, img_bgr) -> Optional[List[float]]:
        """Register: MTCNN strict → MTCNN permissive → opencv permissive."""
        attempts = [(DEEPFACE_BACKEND, True), (DEEPFACE_BACKEND, False), ('opencv', False)]
        for backend, enforce in attempts:
            try:
                result = self._df.represent(
                    img_bgr, model_name='Facenet',
                    enforce_detection=enforce, detector_backend=backend,
                )
                if result:
                    print(f'[face] deepface register OK (backend={backend}, enforce={enforce})')
                    return result[0]['embedding']
            except Exception as e:
                print(f'[face] deepface register attempt failed (backend={backend}, enforce={enforce}): {e}')
        return None

    def embed_all(self, img_bgr) -> List[List[float]]:
        """Match: every detected face's embedding (permissive)."""
        try:
            reps = self._df.represent(
                img_bgr, model_name='Facenet',
                enforce_detection=False, detector_backend=DEEPFACE_BACKEND,
            )
            return [r['embedding'] for r in reps] if reps else []
        except Exception:
            return []
