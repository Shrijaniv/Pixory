"""
InsightFace engine — detection (SCRFD) + recognition (ArcFace 512-d) on
onnxruntime, with a real emotion classifier (HSEmotion-ONNX) for happy-face
counting. No TensorFlow anywhere — this is the lightweight, cheap-to-host path.
"""
from __future__ import annotations

from typing import List, Optional

import cv2
import numpy as np

from .base import BBox, FaceAnalysis

_HAPPY_EMOTIONS = {'happiness', 'happy', 'surprise'}


def _bbox_xywh(face) -> Optional[BBox]:
    # InsightFace returns bbox as [x1, y1, x2, y2]
    x1, y1, x2, y2 = (int(v) for v in face.bbox)
    w, h = x2 - x1, y2 - y1
    if w <= 0 or h <= 0:
        return None
    return (max(0, x1), max(0, y1), w, h)


class InsightFaceEngine:
    name = 'insightface'
    embedding_dim = 512
    match_threshold = 0.35  # ArcFace cosine cutoff (normed embeddings)

    def __init__(self):
        # Lazy heavy imports — only when this engine is built.
        from insightface.app import FaceAnalysis as _FaceAnalysis
        from hsemotion_onnx.facial_emotions import HSEmotionRecognizer

        # buffalo_l = SCRFD detector + ArcFace recogniser; CPU provider.
        self._app = _FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        self._app.prepare(ctx_id=-1, det_size=(640, 640))
        self._emotion = HSEmotionRecognizer(model_name='enet_b0_8_best_afew')
        print('[face] InsightFace engine loaded (ArcFace 512-d, SCRFD + HSEmotion)')

    def _is_happy(self, img_bgr, bbox: BBox) -> bool:
        x, y, w, h = bbox
        crop = img_bgr[y:y + h, x:x + w]
        if crop.size == 0:
            return False
        try:
            rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            emotion, _ = self._emotion.predict_emotions(rgb, logits=False)
            return str(emotion).strip().lower() in _HAPPY_EMOTIONS
        except Exception:
            return False

    def analyze(self, img_bgr) -> FaceAnalysis:
        try:
            faces = self._app.get(img_bgr)
        except Exception:
            return FaceAnalysis()
        bboxes: List[BBox] = []
        happy = 0
        for f in faces:
            bb = _bbox_xywh(f)
            if bb is None:
                continue
            bboxes.append(bb)
            if self._is_happy(img_bgr, bb):
                happy += 1
        return FaceAnalysis(count=len(bboxes), happy_count=happy, bboxes=bboxes)

    def embed_reference(self, img_bgr) -> Optional[List[float]]:
        try:
            faces = self._app.get(img_bgr)
        except Exception:
            return None
        if not faces:
            return None
        # Largest face = the subject of the selfie
        best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        emb = best.normed_embedding  # already L2-normalised
        return np.asarray(emb, dtype=float).tolist()

    def embed_all(self, img_bgr) -> List[List[float]]:
        try:
            faces = self._app.get(img_bgr)
        except Exception:
            return []
        return [np.asarray(f.normed_embedding, dtype=float).tolist() for f in faces]
