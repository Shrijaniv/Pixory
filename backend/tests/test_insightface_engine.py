"""
Tests for the InsightFace engine's two-instance split (audit F1).

The contract that matters:

  * `analyze()` must never build the recogniser. It is called once per photo
    for up to 120 photos, and ArcFace is roughly 8x the cost of detection.
  * `embed_reference()` / `embed_all()` must use the recogniser, because a
    detection-only instance returns faces with no `normed_embedding`.
  * Neither may raise. A single unreadable photo must not fail a batch.

Tests that need real model weights are marked `models`; the rest use fakes so
the wrapper logic is covered in CI, where weights cannot be downloaded.
"""
from __future__ import annotations

from types import SimpleNamespace

import numpy as np
import pytest

from face_engines.insightface_engine import (
    DET_SIZE,
    MIN_EMOTION_FACE_WIDTH_RATIO,
    InsightFaceEngine,
    _bbox_xywh,
)


# ── Fakes ────────────────────────────────────────────────────────────────────

def fake_face(x1=10, y1=10, x2=110, y2=110, embedding=None):
    """Mimic the attribute surface of an insightface Face object."""
    return SimpleNamespace(
        bbox=np.array([x1, y1, x2, y2], dtype=float),
        normed_embedding=np.array(embedding if embedding is not None else [0.1] * 512),
    )


class FakeApp:
    """Stands in for insightface's FaceAnalysis."""

    def __init__(self, faces=(), raises=False):
        self._faces = list(faces)
        self._raises = raises
        self.calls = 0

    def get(self, _img):
        self.calls += 1
        if self._raises:
            raise RuntimeError("onnxruntime exploded")
        return self._faces


class FakeEmotion:
    def __init__(self, label="happiness", raises=False):
        self.label = label
        self.raises = raises
        self.calls = 0

    def predict_emotions(self, _rgb, logits=True):
        self.calls += 1
        if self.raises:
            raise RuntimeError("emotion model unavailable")
        return self.label, [0.9]


@pytest.fixture
def engine():
    return InsightFaceEngine()


def wire(engine, *, detector=None, recognizer=None, emotion=None):
    """Inject fakes without triggering the lazy model builders."""
    if detector is not None:
        engine._detector_app = detector
    if recognizer is not None:
        engine._recognizer_app = recognizer
    if emotion is not None:
        engine._emotion_model = emotion
    return engine


def img(w=512, h=384):
    return np.zeros((h, w, 3), np.uint8)


# ── Construction is cheap ────────────────────────────────────────────────────

def test_constructing_the_engine_loads_no_models(engine):
    assert engine._detector_app is None
    assert engine._recognizer_app is None
    assert engine._emotion_model is None


def test_engine_advertises_its_contract(engine):
    assert engine.name == "insightface"
    assert engine.embedding_dim == 512
    assert 0 < engine.match_threshold < 1


def test_detector_input_size_is_640(engine):
    # Measured: detection-only at 640 reproduces the previous all-module result
    # exactly, while 512 diverges on 10% of real photos. See the module docstring.
    assert DET_SIZE == (640, 640)


# ── analyze() uses detection only ────────────────────────────────────────────

def test_analyze_never_touches_the_recogniser(engine):
    detector = FakeApp([fake_face()])
    wire(engine, detector=detector, emotion=FakeEmotion("neutral"))

    engine.analyze(img())

    assert detector.calls == 1
    assert engine._recognizer_app is None, "analyze must not build ArcFace (audit F1)"


def test_analyze_counts_faces_and_returns_boxes(engine):
    wire(
        engine,
        detector=FakeApp([fake_face(0, 0, 100, 100), fake_face(200, 50, 300, 150)]),
        emotion=FakeEmotion("neutral"),
    )

    result = engine.analyze(img())

    assert result.count == 2
    assert len(result.bboxes) == 2
    assert result.bboxes[0] == (0, 0, 100, 100)
    assert result.bboxes[1] == (200, 50, 100, 100)


def test_analyze_counts_happy_faces(engine):
    wire(engine, detector=FakeApp([fake_face(), fake_face()]), emotion=FakeEmotion("happiness"))

    assert engine.analyze(img()).happy_count == 2


@pytest.mark.parametrize("label,expected", [
    ("happiness", 1), ("happy", 1), ("surprise", 1),
    ("HAPPINESS", 1), ("  happy  ", 1),
    ("neutral", 0), ("sadness", 0), ("anger", 0), ("", 0),
])
def test_happy_classification_is_case_and_whitespace_insensitive(engine, label, expected):
    wire(engine, detector=FakeApp([fake_face()]), emotion=FakeEmotion(label))
    assert engine.analyze(img()).happy_count == expected


def test_analyze_returns_empty_when_detection_raises(engine):
    wire(engine, detector=FakeApp(raises=True))

    result = engine.analyze(img())

    assert result.count == 0
    assert result.happy_count == 0
    assert result.bboxes == []


def test_analyze_skips_degenerate_boxes(engine):
    # A zero-area box would make subject_ratio meaningless downstream.
    wire(
        engine,
        detector=FakeApp([fake_face(10, 10, 10, 10), fake_face(0, 0, 100, 100)]),
        emotion=FakeEmotion("neutral"),
    )

    assert engine.analyze(img()).count == 1


def test_analyze_survives_an_emotion_model_failure(engine):
    wire(engine, detector=FakeApp([fake_face()]), emotion=FakeEmotion(raises=True))

    result = engine.analyze(img())

    assert result.count == 1
    assert result.happy_count == 0


# ── Emotion size gate ────────────────────────────────────────────────────────

def test_emotion_is_skipped_for_a_face_too_small_to_read(engine):
    frame = img(512, 384)
    tiny = int(512 * MIN_EMOTION_FACE_WIDTH_RATIO) - 2
    emotion = FakeEmotion("happiness")
    wire(engine, detector=FakeApp([fake_face(0, 0, tiny, tiny)]), emotion=emotion)

    result = engine.analyze(frame)

    assert result.count == 1, "the face still counts"
    assert result.happy_count == 0, "but its expression is not guessed at"
    assert emotion.calls == 0, "and no inference is paid for"


def test_emotion_runs_for_a_face_large_enough_to_read(engine):
    frame = img(512, 384)
    big = int(512 * MIN_EMOTION_FACE_WIDTH_RATIO) + 20
    emotion = FakeEmotion("happiness")
    wire(engine, detector=FakeApp([fake_face(0, 0, big, big)]), emotion=emotion)

    assert engine.analyze(frame).happy_count == 1
    assert emotion.calls == 1


def test_emotion_is_skipped_for_an_out_of_bounds_crop(engine):
    # A box beyond the frame yields an empty slice; must not raise.
    frame = img(512, 384)
    emotion = FakeEmotion("happiness")
    wire(engine, detector=FakeApp([fake_face(600, 500, 900, 800)]), emotion=emotion)

    result = engine.analyze(frame)

    assert result.count == 1
    assert result.happy_count == 0


# ── embed_reference / embed_all use the recogniser ───────────────────────────

def test_embed_reference_uses_the_recogniser_not_the_detector(engine):
    recognizer = FakeApp([fake_face(embedding=[0.5] * 512)])
    wire(engine, recognizer=recognizer)

    emb = engine.embed_reference(img())

    assert recognizer.calls == 1
    assert engine._detector_app is None
    assert len(emb) == 512


def test_embed_reference_picks_the_largest_face(engine):
    small = fake_face(0, 0, 20, 20, embedding=[0.1] * 512)
    large = fake_face(0, 0, 200, 200, embedding=[0.9] * 512)
    wire(engine, recognizer=FakeApp([small, large]))

    emb = engine.embed_reference(img())

    assert emb[0] == pytest.approx(0.9), "the selfie's subject is the biggest face"


def test_embed_reference_returns_none_when_no_face_is_found(engine):
    wire(engine, recognizer=FakeApp([]))
    assert engine.embed_reference(img()) is None


def test_embed_reference_returns_none_when_the_model_raises(engine):
    wire(engine, recognizer=FakeApp(raises=True))
    assert engine.embed_reference(img()) is None


def test_embed_all_returns_one_vector_per_face(engine):
    wire(engine, recognizer=FakeApp([fake_face(), fake_face(), fake_face()]))

    embeddings = engine.embed_all(img())

    assert len(embeddings) == 3
    assert all(len(e) == 512 for e in embeddings)


def test_embed_all_returns_empty_on_failure(engine):
    wire(engine, recognizer=FakeApp(raises=True))
    assert engine.embed_all(img()) == []


def test_embed_all_returns_empty_when_there_are_no_faces(engine):
    wire(engine, recognizer=FakeApp([]))
    assert engine.embed_all(img()) == []


def test_embeddings_are_plain_json_serialisable_floats(engine):
    import json

    wire(engine, recognizer=FakeApp([fake_face()]))
    json.dumps(engine.embed_all(img()))  # raises on numpy types


# ── Box conversion ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("bbox,expected", [
    ((0, 0, 100, 100), (0, 0, 100, 100)),
    ((10, 20, 110, 140), (10, 20, 100, 120)),
    ((-50, -20, 50, 80), (0, 0, 100, 100)),   # negative origin clamped
    ((100, 100, 100, 200), None),             # zero width
    ((100, 100, 200, 100), None),             # zero height
    ((200, 200, 100, 100), None),             # inverted
])
def test_bbox_conversion(bbox, expected):
    assert _bbox_xywh(SimpleNamespace(bbox=np.array(bbox, dtype=float))) == expected


# ── Warmup ───────────────────────────────────────────────────────────────────

def test_warmup_builds_only_the_detector_by_default(engine, monkeypatch):
    built = []
    monkeypatch.setattr(
        InsightFaceEngine, "_build", lambda self, m: (built.append(tuple(m)), FakeApp())[1]
    )

    engine.warmup()

    assert built == [("detection",)]


def test_warmup_can_also_build_the_recogniser(engine, monkeypatch):
    built = []
    monkeypatch.setattr(
        InsightFaceEngine, "_build", lambda self, m: (built.append(tuple(m)), FakeApp())[1]
    )

    engine.warmup(recognition=True)

    assert built == [("detection",), ("detection", "recognition")]


def test_each_model_is_built_at_most_once(engine, monkeypatch):
    calls = []
    monkeypatch.setattr(
        InsightFaceEngine, "_build", lambda self, m: (calls.append(tuple(m)), FakeApp())[1]
    )

    for _ in range(3):
        engine.detector
        engine.recognizer

    assert calls == [("detection",), ("detection", "recognition")]


# ── Real-weights checks ──────────────────────────────────────────────────────

@pytest.mark.models
def test_detection_only_matches_the_full_module_stack(face_image):
    """The whole premise of the split: dropping modules must not change counts."""
    from insightface.app import FaceAnalysis

    full = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    full.prepare(ctx_id=-1, det_size=DET_SIZE)

    engine = InsightFaceEngine()

    assert len(engine.detector.get(face_image)) == len(full.get(face_image))


@pytest.mark.models
def test_real_embeddings_separate_the_same_face_from_a_different_one(face_image):
    engine = InsightFaceEngine()
    embeddings = engine.embed_all(face_image)
    reference = np.array(engine.embed_reference(face_image))

    sims = sorted(float(np.dot(reference, np.array(e))) for e in embeddings)

    assert sims[-1] == pytest.approx(1.0, abs=1e-3), "a face matches itself"
    assert sims[0] < engine.match_threshold, "different people fall below threshold"
