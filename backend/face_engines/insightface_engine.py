"""
InsightFace engine — detection (SCRFD) + recognition (ArcFace 512-d) on
onnxruntime, with a real emotion classifier (HSEmotion-ONNX) for happy-face
counting. No TensorFlow anywhere — this is the lightweight, cheap-to-host path.

## Why two model instances

`FaceAnalysis(name='buffalo_l')` loads five modules by default: detection,
recognition, landmark_3d_68, landmark_2d_106 and genderage. Counting faces
needs exactly one of them. Running all five to answer "how many faces?" cost
roughly 10x what detection alone costs, and `/score_photos` calls it once per
photo for up to 120 photos — the single largest cost in a curation (audit F1).

So detection and recognition are separate, lazily-built instances:

  * `analyze()`        -> detector only. Used by /score_photos, the hot path.
  * `embed_*()`        -> recogniser. Used by /register_face and /match_faces,
                          which run over a handful of photos, not the whole
                          candidate pool.

Both are built on demand, so a deployment that only ever scores photos never
pays to load ArcFace, and one that only matches faces never loads twice.
"""
from __future__ import annotations

import time
from typing import List, Optional

import cv2
import numpy as np

from .base import BBox, FaceAnalysis

_HAPPY_EMOTIONS = {'happiness', 'happy', 'surprise'}

# Kept at 640 deliberately. Measured over 106 real 512px photos (132 faces):
#
#   all-5 @640 (previous)   0.274 s/photo   132 faces   — baseline
#   detect-only @640        0.102 s/photo   132 faces   100% identical
#   detect-only @512        0.064 s/photo   131 faces    90% identical
#   detect-only @448        0.055 s/photo   128 faces    88% identical
#
# Dropping the unused modules is free accuracy-wise; shrinking the detector
# input is not. Face count feeds scoring, shot type, group size and the
# my-face filter, so a 10% change in what is detected is not worth 0.04s.
DET_SIZE = (640, 640)

# Emotion inference runs per face and is pure overhead on a face too small to
# read an expression from. Below this fraction of frame width, skip it and
# count the face as not-happy rather than paying for a coin flip.
MIN_EMOTION_FACE_WIDTH_RATIO = 0.04


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
        # Nothing heavy here. Each model is built the first time it is needed,
        # so importing the engine costs nothing and a scoring-only deployment
        # never loads the recogniser.
        self._detector_app = None
        self._recognizer_app = None
        self._emotion_model = None

    # ── Lazily built models ──────────────────────────────────────────────────

    def _build(self, modules: List[str]):
        from insightface.app import FaceAnalysis as _FaceAnalysis

        started = time.time()
        app = _FaceAnalysis(
            name='buffalo_l',
            providers=['CPUExecutionProvider'],
            allowed_modules=modules,
        )
        app.prepare(ctx_id=-1, det_size=DET_SIZE)
        print(
            f'[face] InsightFace {"+".join(modules)} ready '
            f'in {time.time() - started:.1f}s (det_size={DET_SIZE[0]})'
        )
        return app

    @property
    def detector(self):
        """Detection only — the hot path for /score_photos."""
        if self._detector_app is None:
            self._detector_app = self._build(['detection'])
        return self._detector_app

    @property
    def recognizer(self):
        """Detection + ArcFace embeddings — only for register/match."""
        if self._recognizer_app is None:
            self._recognizer_app = self._build(['detection', 'recognition'])
        return self._recognizer_app

    @property
    def emotion(self):
        if self._emotion_model is None:
            from hsemotion_onnx.facial_emotions import HSEmotionRecognizer

            self._emotion_model = HSEmotionRecognizer(model_name='enet_b0_8_best_afew')
            print('[face] HSEmotion ready')
        return self._emotion_model

    def warmup(self, recognition: bool = False) -> None:
        """Build models ahead of the first request (used at container start)."""
        blank = np.zeros((DET_SIZE[1], DET_SIZE[0], 3), np.uint8)
        self.detector.get(blank)
        if recognition:
            self.recognizer.get(blank)

    # ── Capabilities ─────────────────────────────────────────────────────────

    def _is_happy(self, img_bgr, bbox: BBox) -> bool:
        x, y, w, h = bbox
        # Too small to read an expression from — don't pay for the inference.
        if w < img_bgr.shape[1] * MIN_EMOTION_FACE_WIDTH_RATIO:
            return False
        crop = img_bgr[y:y + h, x:x + w]
        if crop.size == 0:
            return False
        try:
            rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            emotion, _ = self.emotion.predict_emotions(rgb, logits=False)
            return str(emotion).strip().lower() in _HAPPY_EMOTIONS
        except Exception:
            return False

    def analyze(self, img_bgr) -> FaceAnalysis:
        """Face count, happy count and boxes. Detection only — no ArcFace."""
        try:
            faces = self.detector.get(img_bgr)
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
        """One embedding for the largest face — the subject of a selfie."""
        try:
            faces = self.recognizer.get(img_bgr)
        except Exception:
            return None
        if not faces:
            return None
        best = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
        emb = best.normed_embedding  # already L2-normalised
        return np.asarray(emb, dtype=float).tolist()

    def embed_all(self, img_bgr) -> List[List[float]]:
        """Every detected face's embedding, for matching candidates."""
        try:
            faces = self.recognizer.get(img_bgr)
        except Exception:
            return []
        return [np.asarray(f.normed_embedding, dtype=float).tolist() for f in faces]
