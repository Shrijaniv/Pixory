from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

import cv2
import numpy as np

from app.models.photo import Photo
from app.config.settings import SCORING_WEIGHTS, THUMBNAIL_MAX_DIM, MAX_WORKER_THREADS


def _score_sharpness(gray: np.ndarray) -> float:
    """
    Laplacian variance measures edge intensity — blurry images have low variance.
    Normalized: 0 = very blurry, 1 = very sharp (saturates at variance=1000).
    """
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    return min(variance / 1000.0, 1.0)


def _score_lighting(img_bgr: np.ndarray) -> float:
    """
    Score exposure quality. Penalizes images with too many
    crushed shadows (< 20) or blown highlights (> 235).
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    hist = hist / hist.sum()

    dark_ratio = hist[:20].sum()
    bright_ratio = hist[235:].sum()

    penalty = (dark_ratio + bright_ratio) * 3
    return max(0.0, 1.0 - penalty)


def _score_composition(img_bgr: np.ndarray) -> float:
    """
    Approximate rule-of-thirds composition score.
    Checks whether significant edge content falls near the four
    rule-of-thirds intersection points.
    """
    h, w = img_bgr.shape[:2]
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)

    total_edges = float(edges.sum())
    if total_edges == 0:
        return 0.5  # Neutral score for blank images

    roi_mask = np.zeros_like(edges)
    third_h, third_w = h // 3, w // 3
    zone = 20  # pixel radius around each intersection

    for row in [third_h, 2 * third_h]:
        for col in [third_w, 2 * third_w]:
            r0, r1 = max(0, row - zone), min(h, row + zone)
            c0, c1 = max(0, col - zone), min(w, col + zone)
            roi_mask[r0:r1, c0:c1] = 255

    roi_edges = float(cv2.bitwise_and(edges, roi_mask).sum())
    # Normalize: if 30%+ of edges are in ROI zones, score = 1.0
    return min(roi_edges / (total_edges * 0.3), 1.0)


def score_photo(photo: Photo) -> Photo:
    """Compute all quality scores for a single photo."""
    try:
        img_bgr = cv2.imread(str(photo.path))
        if img_bgr is None:
            return photo

        # Resize for consistent, fast scoring
        h, w = img_bgr.shape[:2]
        if max(h, w) > THUMBNAIL_MAX_DIM:
            scale = THUMBNAIL_MAX_DIM / max(h, w)
            img_bgr = cv2.resize(img_bgr, (int(w * scale), int(h * scale)))

        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        photo.sharpness_score = _score_sharpness(gray)
        photo.lighting_score = _score_lighting(img_bgr)
        photo.composition_score = _score_composition(img_bgr)

        photo.combined_score = (
            photo.sharpness_score * SCORING_WEIGHTS["sharpness"]
            + photo.lighting_score * SCORING_WEIGHTS["lighting"]
            + photo.composition_score * SCORING_WEIGHTS["composition"]
        )
    except Exception as e:
        print(f"  Warning: could not score {photo.path.name}: {e}")

    return photo


def score_photos(photos: List[Photo]) -> List[Photo]:
    """Score all photos in parallel using a thread pool."""
    with ThreadPoolExecutor(max_workers=MAX_WORKER_THREADS) as executor:
        futures = {executor.submit(score_photo, p): p for p in photos}
        scored: List[Photo] = []
        for future in as_completed(futures):
            scored.append(future.result())
    return scored
