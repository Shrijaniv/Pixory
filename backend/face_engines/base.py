"""
Face-engine abstraction. Two interchangeable implementations (DeepFace and
InsightFace) provide the same three capabilities used by the sidecar:

  • analyze(img)          → face count + happy-face count + bounding boxes
  • embed_reference(img)  → one embedding for "this is the user" (register)
  • embed_all(img)        → every face's embedding for matching candidates

Engines are selected per-request via a `face_engine` field so DeepFace and
InsightFace can be A/B-tested without removing either.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Protocol, Tuple

BBox = Tuple[int, int, int, int]  # (x, y, w, h)


@dataclass
class FaceAnalysis:
    count: int = 0
    happy_count: int = 0
    bboxes: List[BBox] = field(default_factory=list)


class FaceEngine(Protocol):
    name: str
    embedding_dim: int
    match_threshold: float  # default cosine cutoff for "same person"

    def analyze(self, img_bgr) -> FaceAnalysis:
        """Detect faces; return count, happy-face count, and bounding boxes."""
        ...

    def embed_reference(self, img_bgr) -> Optional[List[float]]:
        """Best single embedding for the reference selfie (register)."""
        ...

    def embed_all(self, img_bgr) -> List[List[float]]:
        """Every detected face's embedding (match); may be empty."""
        ...
