import os
from pathlib import Path
from typing import List

from app.models.photo import Photo
from app.utils.exif_parser import parse_exif
from app.config.settings import SUPPORTED_EXTENSIONS


def scan_gallery(root_path: str) -> List[Photo]:
    """
    Recursively scan a directory for supported image files.
    Extracts EXIF metadata (date, GPS, dimensions) for each photo.
    Returns photos sorted by capture date (undated photos go last).
    """
    root = Path(root_path)
    if not root.exists():
        raise FileNotFoundError(f"Photo folder not found: {root_path}")

    photos: List[Photo] = []

    for dirpath, _, filenames in os.walk(root):
        for filename in sorted(filenames):
            path = Path(dirpath) / filename
            if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue

            exif = parse_exif(path)
            photo = Photo(
                path=path,
                date=exif["date"],
                lat=exif["lat"],
                lon=exif["lon"],
                width=exif["width"],
                height=exif["height"],
                file_size=path.stat().st_size,
            )
            photos.append(photo)

    # Sort by date; photos without dates go to the end
    photos.sort(key=lambda p: (p.date is None, p.date))
    return photos
