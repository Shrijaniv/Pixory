from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List

import imagehash
from PIL import Image

from app.models.photo import Photo
from app.config.settings import DUPLICATE_HASH_THRESHOLD, MAX_WORKER_THREADS


def _compute_hash(photo: Photo) -> Photo:
    """Compute perceptual hash for a single photo."""
    try:
        with Image.open(photo.path) as img:
            img.thumbnail((512, 512))
            img = img.convert("RGB")
            photo.phash = str(imagehash.phash(img))
    except Exception:
        photo.phash = None
    return photo


def remove_duplicates(photos: List[Photo]) -> List[Photo]:
    """
    Detect and remove near-duplicate photos using perceptual hashing (pHash).
    When duplicates are found, keeps the highest-resolution version.
    Returns the deduplicated list, sorted by resolution descending.
    """
    # Compute hashes in parallel
    with ThreadPoolExecutor(max_workers=MAX_WORKER_THREADS) as executor:
        futures = {executor.submit(_compute_hash, p): p for p in photos}
        hashed: List[Photo] = []
        for future in as_completed(futures):
            hashed.append(future.result())

    # Sort by resolution descending so we keep the best copy
    hashed.sort(key=lambda p: p.width * p.height, reverse=True)

    unique: List[Photo] = []
    seen_hashes: List[imagehash.ImageHash] = []

    for photo in hashed:
        if photo.phash is None:
            # Can't hash it; keep it to avoid accidental data loss
            unique.append(photo)
            continue

        current = imagehash.hex_to_hash(photo.phash)
        is_duplicate = any(
            current - seen <= DUPLICATE_HASH_THRESHOLD for seen in seen_hashes
        )

        if not is_duplicate:
            unique.append(photo)
            seen_hashes.append(current)

    return unique
