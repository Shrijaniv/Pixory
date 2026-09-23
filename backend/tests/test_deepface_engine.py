"""
DeepFace engine tests, focused on the no-face sentinel (audit F3).

With `enforce_detection=False` — which the scoring path must use, since a
landscape legitimately has no face — DeepFace does not return an empty list
when it finds nothing. It returns one entry covering the whole frame with
`face_confidence` 0. The old code took `len(results)` as the face count, so
every landscape reported exactly one face.

Verified against 8 real landscape photos: 8/8 reported a face before the fix,
0/8 after, and a genuine detection at confidence 0.86 is still kept.

The engine itself is unreachable from the app now (the toggle is pinned to
InsightFace), but the branch that carries it must not keep the landmine.
"""
from __future__ import annotations

import numpy as np
import pytest

from face_engines.deepface_engine import (
    MIN_FACE_CONFIDENCE,
    WHOLE_FRAME_RATIO,
    DeepFaceEngine,
    _is_real_face,
)

FRAME = (384, 512, 3)  # h, w, c — the shape the app uploads


# ── _is_real_face ────────────────────────────────────────────────────────────

def test_rejects_the_whole_frame_sentinel_by_confidence():
    sentinel = {"x": 0, "y": 0, "w": 511, "h": 383, "face_confidence": 0.0}
    assert _is_real_face(sentinel, FRAME) is False


def test_rejects_the_whole_frame_sentinel_by_geometry_when_confidence_is_absent():
    # Older DeepFace builds omit face_confidence entirely.
    sentinel = {"x": 0, "y": 0, "w": 511, "h": 383}
    assert _is_real_face(sentinel, FRAME) is False


def test_keeps_a_genuine_detection():
    # Taken from a real photo: confidence 0.86, a modest box.
    real = {"x": 119, "y": 198, "w": 100, "h": 117, "face_confidence": 0.86}
    assert _is_real_face(real, FRAME) is True


def test_keeps_a_genuine_detection_without_a_confidence_field():
    assert _is_real_face({"x": 119, "y": 198, "w": 100, "h": 117}, FRAME) is True


@pytest.mark.parametrize("confidence,expected", [
    (0.0, False),
    (MIN_FACE_CONFIDENCE - 0.01, False),
    (MIN_FACE_CONFIDENCE, True),
    (0.99, True),
    (1.0, True),
])
def test_confidence_threshold_boundaries(confidence, expected):
    region = {"x": 10, "y": 10, "w": 80, "h": 90, "face_confidence": confidence}
    assert _is_real_face(region, FRAME) is expected


@pytest.mark.parametrize("w,h", [(0, 50), (50, 0), (0, 0), (-10, 50)])
def test_rejects_degenerate_boxes(w, h):
    assert _is_real_face({"x": 0, "y": 0, "w": w, "h": h}, FRAME) is False


def test_rejects_an_empty_region():
    assert _is_real_face({}, FRAME) is False


def test_a_large_but_confident_face_is_kept():
    """A real close-up can fill most of the frame; confidence must win."""
    close_up = {"x": 0, "y": 0, "w": 511, "h": 383, "face_confidence": 0.97}
    assert _is_real_face(close_up, FRAME) is True


def test_a_face_just_under_the_whole_frame_ratio_is_kept():
    w = int(512 * WHOLE_FRAME_RATIO) - 1
    h = int(384 * WHOLE_FRAME_RATIO) - 1
    assert _is_real_face({"x": 0, "y": 0, "w": w, "h": h}, FRAME) is True


def test_geometry_check_is_skipped_for_a_degenerate_frame():
    region = {"x": 0, "y": 0, "w": 100, "h": 100}
    assert _is_real_face(region, (0, 0, 3)) is True


# ── analyze() ────────────────────────────────────────────────────────────────

class FakeDeepFace:
    def __init__(self, results):
        self._results = results

    def analyze(self, *_args, **_kwargs):
        return self._results


def engine_with(results):
    engine = DeepFaceEngine.__new__(DeepFaceEngine)  # skip the TensorFlow import
    engine._df = FakeDeepFace(results)
    engine._face_cascade = None
    return engine


def img():
    return np.zeros(FRAME, np.uint8)


def test_analyze_reports_no_face_for_the_sentinel():
    engine = engine_with([
        {"region": {"x": 0, "y": 0, "w": 511, "h": 383}, "face_confidence": 0.0,
         "dominant_emotion": "neutral"}
    ])

    result = engine.analyze(img())

    assert result.count == 0
    assert result.bboxes == []


def test_analyze_counts_a_genuine_detection():
    engine = engine_with([
        {"region": {"x": 10, "y": 20, "w": 90, "h": 100}, "face_confidence": 0.9,
         "dominant_emotion": "happy"}
    ])

    result = engine.analyze(img())

    assert result.count == 1
    assert result.happy_count == 1
    assert result.bboxes == [(10, 20, 90, 100)]


def test_analyze_counts_only_the_real_faces_in_a_mixed_response():
    engine = engine_with([
        {"region": {"x": 0, "y": 0, "w": 511, "h": 383}, "face_confidence": 0.0,
         "dominant_emotion": "neutral"},
        {"region": {"x": 10, "y": 20, "w": 90, "h": 100}, "face_confidence": 0.9,
         "dominant_emotion": "happy"},
    ])

    assert engine.analyze(img()).count == 1


def test_happy_count_only_counts_real_faces():
    """The sentinel must not be able to contribute a happy face."""
    engine = engine_with([
        {"region": {"x": 0, "y": 0, "w": 511, "h": 383}, "face_confidence": 0.0,
         "dominant_emotion": "happy"},
    ])

    assert engine.analyze(img()).happy_count == 0


@pytest.mark.parametrize("emotion,expected", [
    ("happy", 1), ("surprise", 1), ("neutral", 0), ("sad", 0), ("", 0),
])
def test_happy_emotions(emotion, expected):
    engine = engine_with([
        {"region": {"x": 10, "y": 10, "w": 90, "h": 90}, "face_confidence": 0.9,
         "dominant_emotion": emotion},
    ])

    assert engine.analyze(img()).happy_count == expected


def test_analyze_accepts_a_single_dict_response():
    """DeepFace returns a bare dict for a single face on some versions."""
    engine = engine_with(
        {"region": {"x": 10, "y": 10, "w": 90, "h": 90}, "face_confidence": 0.9,
         "dominant_emotion": "happy"}
    )

    assert engine.analyze(img()).count == 1


def test_analyze_reads_confidence_nested_inside_region():
    engine = engine_with([
        {"region": {"x": 0, "y": 0, "w": 511, "h": 383, "face_confidence": 0.0}},
    ])

    assert engine.analyze(img()).count == 0


def test_analyze_falls_back_to_haar_when_deepface_raises():
    class Boom:
        def analyze(self, *_a, **_k):
            raise RuntimeError("tensorflow died")

    class FakeCascade:
        def detectMultiScale(self, *_a, **_k):
            return [(10, 20, 30, 40)]

    engine = DeepFaceEngine.__new__(DeepFaceEngine)
    engine._df = Boom()
    engine._face_cascade = FakeCascade()

    result = engine.analyze(img())

    assert result.count == 1
    assert result.bboxes == [(10, 20, 30, 40)]
    assert result.happy_count == 0
