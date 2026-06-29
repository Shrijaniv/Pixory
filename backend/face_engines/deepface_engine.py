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
            bboxes: List[BBox] = []
            for f in results:
                region = f.get('region', {})
                w, h = region.get('w', 0), region.get('h', 0)
                if w > 0 and h > 0:
                    bboxes.append((region.get('x', 0), region.get('y', 0), w, h))
            happy = sum(1 for f in results if f.get('dominant_emotion', '') in _HAPPY_EMOTIONS)
            return FaceAnalysis(count=len(results), happy_count=happy, bboxes=bboxes)
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
