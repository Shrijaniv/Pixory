"""
Face-engine registry. `get_engine(name)` lazily constructs and caches the
requested engine — importing DeepFace/TensorFlow only when 'deepface' is asked
for, and InsightFace/onnxruntime only when 'insightface' is. This keeps a
single-engine production deploy from paying for the other engine's deps.
"""
from __future__ import annotations

import os

from .base import FaceAnalysis, FaceEngine

DEFAULT_ENGINE = os.environ.get('FACE_ENGINE', 'deepface').lower()

_cache: dict[str, FaceEngine] = {}


def get_engine(name: str | None = None) -> FaceEngine:
    key = (name or DEFAULT_ENGINE or 'deepface').lower()
    if key not in _cache:
        if key == 'insightface':
            from .insightface_engine import InsightFaceEngine
            _cache[key] = InsightFaceEngine()
        else:
            key = 'deepface'
            if key not in _cache:
                from .deepface_engine import DeepFaceEngine
                _cache[key] = DeepFaceEngine()
    return _cache[key]


__all__ = ['get_engine', 'FaceEngine', 'FaceAnalysis', 'DEFAULT_ENGINE']
