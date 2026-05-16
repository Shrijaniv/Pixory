"""
eval_sidecar_signals.py

Verifies that the /score_photos sidecar endpoint returns all expected signals
and that they fall in correct ranges for synthetic images.

Requires: sidecar running at http://localhost:8001
Run: python backend/scripts/eval_sidecar_signals.py
"""

import base64
import io
import sys
import json
import urllib.request
import numpy as np
import cv2

SIDECAR_URL = "http://localhost:8001/score_photos"

# ── Helpers ───────────────────────────────────────────────────────────────────

passed = 0
failed = 0


def assert_range(label: str, value: float, lo: float, hi: float):
    global passed, failed
    if lo <= value <= hi:
        print(f"  ✓ {label}: {value:.3f} ∈ [{lo}, {hi}]")
        passed += 1
    else:
        print(f"  ✗ {label}: {value:.3f} NOT in [{lo}, {hi}]", file=sys.stderr)
        failed += 1


def assert_gt(label: str, a: float, b: float):
    global passed, failed
    if a > b:
        print(f"  ✓ {label}: {a:.3f} > {b:.3f}")
        passed += 1
    else:
        print(f"  ✗ {label}: {a:.3f} should be > {b:.3f}", file=sys.stderr)
        failed += 1


def img_to_b64(img_bgr: np.ndarray) -> str:
    """Encode a numpy BGR image to base64 JPEG."""
    _, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 95])
    return base64.b64encode(buf.tobytes()).decode()


def score_images(images: list[tuple[int, np.ndarray]]) -> dict:
    """Call the sidecar and return a dict of index→score."""
    payload = {
        "photos": [
            {"index": idx, "data_b64": img_to_b64(img)}
            for idx, img in images
        ]
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        SIDECAR_URL,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: Could not reach sidecar at {SIDECAR_URL}: {e}", file=sys.stderr)
        print("Is the sidecar running? Start it with: python backend/publish_sidecar.py")
        sys.exit(1)

    return {s["index"]: s for s in data["scores"]}


# ── Synthetic images ──────────────────────────────────────────────────────────
SIZE = 256  # small so the test is fast

# Solid black → brightness ≈ 0
black = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)

# Solid white → brightness ≈ 1
white = np.full((SIZE, SIZE, 3), 255, dtype=np.uint8)

# Mid grey → brightness ≈ 0.5 → brightness_quality ≈ 1.0
midgrey = np.full((SIZE, SIZE, 3), 128, dtype=np.uint8)

# Pure random noise → high complexity, high "sharpness" (lots of edges)
np.random.seed(42)
noise = np.random.randint(0, 256, (SIZE, SIZE, 3), dtype=np.uint8)

# Gaussian blurred solid gradient → low sharpness
gradient = np.tile(np.linspace(50, 200, SIZE, dtype=np.uint8), (SIZE, 1))
gradient_bgr = np.stack([gradient, gradient, gradient], axis=-1)
blurred = cv2.GaussianBlur(gradient_bgr, (31, 31), 10)

# Pure red (full saturation in HSV) → high saturation
pure_red = np.zeros((SIZE, SIZE, 3), dtype=np.uint8)
pure_red[:, :, 2] = 255  # BGR: red channel

images = [
    (0, black),
    (1, white),
    (2, midgrey),
    (3, noise),
    (4, blurred),
    (5, pure_red),
]

print("\nFetching scores from sidecar...")
scores = score_images(images)

expected_fields = {"sharpness", "face_count", "happy_face_count",
                   "brightness", "brightness_quality", "contrast",
                   "saturation", "complexity"}
print("\n── Field presence check ─────────────────────────────────────────────")
for field in sorted(expected_fields):
    present = field in scores[0]
    if present:
        print(f"  ✓ {field} present")
        passed += 1
    else:
        print(f"  ✗ {field} MISSING from response", file=sys.stderr)
        failed += 1

print("\n── Black image (idx=0) ───────────────────────────────────────────────")
b = scores[0]
assert_range("brightness",         b["brightness"],         0.0, 0.05)
assert_range("brightness_quality", b["brightness_quality"], 0.0, 0.15)

print("\n── White image (idx=1) ───────────────────────────────────────────────")
w = scores[1]
assert_range("brightness",         w["brightness"],         0.95, 1.0)
assert_range("brightness_quality", w["brightness_quality"], 0.0, 0.15)

print("\n── Mid-grey image (idx=2) ────────────────────────────────────────────")
g = scores[2]
assert_range("brightness",         g["brightness"],         0.45, 0.55)
assert_range("brightness_quality", g["brightness_quality"], 0.85, 1.0)
assert_range("sharpness",          g["sharpness"],          0.0, 0.10)  # uniform → no edges

print("\n── Noise image (idx=3) ───────────────────────────────────────────────")
n = scores[3]
assert_range("sharpness",   n["sharpness"],   0.80, 1.0)   # noise is "sharp" (high variance)
assert_range("complexity",  n["complexity"],  0.20, 1.0)   # lots of edges
assert_range("contrast",    n["contrast"],    0.50, 1.0)   # high std-dev

print("\n── Blurred gradient (idx=4) ──────────────────────────────────────────")
bl = scores[4]
assert_range("sharpness",  bl["sharpness"],  0.0, 0.15)   # very blurry → low Laplacian variance

print("\n── Pure red (idx=5) ──────────────────────────────────────────────────")
r = scores[5]
assert_range("saturation", r["saturation"], 0.80, 1.0)    # full HSV saturation

print("\n── Relative assertions ───────────────────────────────────────────────")
assert_gt("noise sharpness > blurred sharpness",  n["sharpness"],  bl["sharpness"])
assert_gt("noise complexity > midgrey complexity", n["complexity"], g["complexity"])
assert_gt("midgrey bq > black bq",                g["brightness_quality"], b["brightness_quality"])
assert_gt("midgrey bq > white bq",                g["brightness_quality"], w["brightness_quality"])
assert_gt("red saturation > midgrey saturation",   r["saturation"], g["saturation"])

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'─' * 55}")
print(f"Results: {passed} passed, {failed} failed")
if failed > 0:
    print("EVAL FAILED — check sidecar signal computation", file=sys.stderr)
    sys.exit(1)
else:
    print("All assertions pass ✓")
