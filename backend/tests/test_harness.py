"""
Harness smoke tests — prove the three test surfaces the later Phase 0 issues
build on actually work: synthetic image factories, the FastAPI test client,
and the face-engine registry.
"""
from __future__ import annotations

import cv2
import numpy as np
import pytest

from face_engines import DEFAULT_ENGINE, get_engine


# ── Image factories ──────────────────────────────────────────────────────────

def _lap_var(img: np.ndarray) -> float:
    return cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()


def test_sharp_fixture_has_more_detail_than_blurry(sharp_img, blurry_img):
    assert _lap_var(sharp_img) > _lap_var(blurry_img) * 10


def test_flat_fixture_has_effectively_no_detail(flat_img):
    assert _lap_var(flat_img) == pytest.approx(0.0, abs=1e-6)


def test_zoo_covers_every_scoring_signal(image_zoo):
    assert set(image_zoo) == {
        "sharp", "blurry", "flat", "dark", "blown", "saturated", "busy", "near_dup",
    }
    for name, img in image_zoo.items():
        assert img.ndim == 3 and img.shape[2] == 3, name
        assert img.dtype == np.uint8, name


def test_dark_and_blown_sit_at_opposite_exposure_extremes(image_zoo):
    dark = cv2.cvtColor(image_zoo["dark"], cv2.COLOR_BGR2GRAY).mean() / 255.0
    blown = cv2.cvtColor(image_zoo["blown"], cv2.COLOR_BGR2GRAY).mean() / 255.0
    assert dark < 0.1 < 0.9 < blown


def test_busy_has_higher_edge_density_than_flat(image_zoo):
    def density(img):
        edges = cv2.Canny(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 50, 150)
        return (edges > 0).sum() / edges.size

    assert density(image_zoo["busy"]) > density(image_zoo["flat"])


def test_near_duplicate_is_a_different_encoding_of_the_same_scene(image_zoo, jpeg_b64):
    original, dup = image_zoo["sharp"], image_zoo["near_dup"]
    assert jpeg_b64(original) != jpeg_b64(dup), "fixtures must differ byte-wise"
    assert original.shape == dup.shape


def test_jpeg_b64_round_trips(sharp_img, jpeg_b64):
    import base64

    raw = base64.b64decode(jpeg_b64(sharp_img))
    decoded = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    assert decoded.shape == sharp_img.shape


# ── FastAPI client ───────────────────────────────────────────────────────────

def test_health_endpoint_reports_the_default_engine(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["service"] == "publish-sidecar"
    assert body["face_engine_default"] == DEFAULT_ENGINE


def test_score_photos_accepts_an_empty_batch(client):
    resp = client.post("/score_photos", json={"photos": []})
    assert resp.status_code == 200
    assert resp.json() == {"scores": []}


def test_match_faces_with_no_photos_returns_no_matches(client):
    resp = client.post(
        "/match_faces", json={"reference_embedding": [0.1] * 512, "photos": []}
    )
    assert resp.status_code == 200
    assert resp.json() == {"matches": []}


def test_register_face_rejects_undecodable_input(client):
    resp = client.post("/register_face", json={"photo_b64": "bm90LWFuLWltYWdl"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is False
    assert "decode" in body["error"].lower()


# ── Engine registry ──────────────────────────────────────────────────────────

def test_default_engine_is_insightface():
    assert DEFAULT_ENGINE == "insightface"


def test_unknown_engine_name_falls_back_to_deepface(monkeypatch):
    """Documents today's behaviour; #6 removes the deepface path entirely."""
    import face_engines

    monkeypatch.setattr(face_engines, "_cache", {})
    sentinel = object()
    monkeypatch.setattr(
        "face_engines.deepface_engine.DeepFaceEngine", lambda: sentinel, raising=False
    )
    assert get_engine("nonsense-engine") is sentinel


@pytest.mark.models
def test_insightface_detects_every_face_in_the_sample(face_image):
    engine = get_engine("insightface")
    analysis = engine.analyze(face_image)
    assert analysis.count == 6
    assert 0 <= analysis.happy_count <= analysis.count
    assert len(analysis.bboxes) == analysis.count
    for x, y, w, h in analysis.bboxes:
        assert w > 0 and h > 0 and x >= 0 and y >= 0


@pytest.mark.models
def test_insightface_reference_embedding_is_unit_length(face_image):
    emb = get_engine("insightface").embed_reference(face_image)
    assert emb is not None and len(emb) == 512
    assert np.linalg.norm(emb) == pytest.approx(1.0, abs=1e-3)


@pytest.mark.models
def test_insightface_finds_no_face_in_a_flat_image(flat_img):
    engine = get_engine("insightface")
    assert engine.analyze(flat_img).count == 0
    assert engine.embed_reference(flat_img) is None
    assert engine.embed_all(flat_img) == []
