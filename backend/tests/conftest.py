"""
Shared fixtures for the sidecar test-suite.

Images are generated deterministically with OpenCV so the suite needs no
binary assets and no network. Anything that needs a *real* face uses the
sample images shipped inside the installed `insightface` package, which are
marked `models` and skipped where weights are unavailable.
"""
from __future__ import annotations

import base64
import os
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

RNG = np.random.default_rng(1729)


# ── Image factories ──────────────────────────────────────────────────────────

def _jpeg_b64(img: np.ndarray, quality: int = 85) -> str:
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    assert ok, "failed to encode fixture image"
    return base64.b64encode(buf.tobytes()).decode("ascii")


def make_sharp(w: int = 512, h: int = 384) -> np.ndarray:
    """High Laplacian variance: hard-edged checkerboard over a mid-grey ground."""
    img = np.full((h, w, 3), 128, np.uint8)
    step = 16
    for y in range(0, h, step):
        for x in range(0, w, step):
            if (x // step + y // step) % 2 == 0:
                img[y:y + step, x:x + step] = 240
    return img


def make_blurry(w: int = 512, h: int = 384) -> np.ndarray:
    """Same content as `make_sharp`, heavily blurred — low Laplacian variance."""
    return cv2.GaussianBlur(make_sharp(w, h), (31, 31), 0)


def make_flat(value: int = 128, w: int = 512, h: int = 384) -> np.ndarray:
    """Zero-detail image: no edges, no faces, no saturation."""
    return np.full((h, w, 3), value, np.uint8)


def make_dark(w: int = 512, h: int = 384) -> np.ndarray:
    return make_flat(8, w, h)


def make_blown(w: int = 512, h: int = 384) -> np.ndarray:
    return make_flat(250, w, h)


def make_saturated(w: int = 512, h: int = 384) -> np.ndarray:
    """Strong single-hue field — high mean HSV saturation."""
    hsv = np.zeros((h, w, 3), np.uint8)
    hsv[:, :, 0] = 100        # hue
    hsv[:, :, 1] = 255        # saturation
    hsv[:, :, 2] = 180        # value
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)


def make_busy(w: int = 512, h: int = 384) -> np.ndarray:
    """Dense random noise — maximal edge density / complexity."""
    return RNG.integers(0, 256, (h, w, 3), dtype=np.uint8)


def make_near_duplicate(base: np.ndarray, shift: int = 3) -> np.ndarray:
    """Translate an image a few pixels — same perceptual hash, different bytes."""
    m = np.float32([[1, 0, shift], [0, 1, shift]])
    return cv2.warpAffine(base, m, (base.shape[1], base.shape[0]), borderMode=cv2.BORDER_REPLICATE)


# ── Pytest fixtures ──────────────────────────────────────────────────────────

@pytest.fixture
def jpeg_b64():
    """Encode any BGR array as a base64 JPEG string."""
    return _jpeg_b64


@pytest.fixture
def sharp_img():
    return make_sharp()


@pytest.fixture
def blurry_img():
    return make_blurry()


@pytest.fixture
def flat_img():
    return make_flat()


@pytest.fixture
def image_zoo():
    """Every synthetic image keyed by name — for table-driven assertions."""
    sharp = make_sharp()
    return {
        "sharp": sharp,
        "blurry": make_blurry(),
        "flat": make_flat(),
        "dark": make_dark(),
        "blown": make_blown(),
        "saturated": make_saturated(),
        "busy": make_busy(),
        "near_dup": make_near_duplicate(sharp),
    }


@pytest.fixture
def client():
    """FastAPI test client over the real sidecar app."""
    import publish_sidecar

    return TestClient(publish_sidecar.app)


@pytest.fixture
def face_image_path() -> Path:
    """A real multi-face photo shipped inside the installed insightface package."""
    try:
        import insightface
    except ImportError:  # pragma: no cover - exercised only where the dep is absent
        pytest.skip("insightface not installed")
    p = Path(insightface.__file__).parent / "data" / "images" / "t1.jpg"
    if not p.exists():  # pragma: no cover - depends on the installed distribution
        pytest.skip("insightface sample images not present")
    return p


@pytest.fixture
def face_image(face_image_path) -> np.ndarray:
    """The sample photo resized to the 512px width the app actually sends."""
    img = cv2.imread(str(face_image_path))
    h, w = img.shape[:2]
    return cv2.resize(img, (512, int(h * 512 / w)))


def pytest_configure(config):
    """Default FACE_ENGINE so tests never depend on the developer's shell."""
    os.environ.setdefault("FACE_ENGINE", "insightface")
