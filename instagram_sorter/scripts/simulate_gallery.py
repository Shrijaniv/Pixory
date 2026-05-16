#!/usr/bin/env python3
"""
Create a fake photo gallery for testing the pipeline without real photos.

Usage:
    python scripts/simulate_gallery.py --out /tmp/test_gallery --count 40

Generates photos across 3 simulated locations with varied quality,
dates, and some intentional duplicates.
"""
import argparse
import io
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

import piexif
from PIL import Image, ImageFilter, ImageDraw

LOCATIONS = [
    {"name": "Paris",   "lat": 48.8566,  "lon": 2.3522},
    {"name": "Tokyo",   "lat": 35.6895,  "lon": 139.6917},
    {"name": "NewYork", "lat": 40.7128,  "lon": -74.0060},
]


def _make_rational(value: float) -> list:
    """Convert float to EXIF rational tuple."""
    degrees = int(value)
    minutes_float = (value - degrees) * 60
    minutes = int(minutes_float)
    seconds = round((minutes_float - minutes) * 60 * 10000)
    return [(degrees, 1), (minutes, 1), (seconds, 10000)]


def _write_exif(lat: float, lon: float, date: datetime) -> bytes:
    gps_ifd = {
        piexif.GPSIFD.GPSLatitudeRef:  b"N" if lat >= 0 else b"S",
        piexif.GPSIFD.GPSLatitude:     _make_rational(abs(lat)),
        piexif.GPSIFD.GPSLongitudeRef: b"E" if lon >= 0 else b"W",
        piexif.GPSIFD.GPSLongitude:    _make_rational(abs(lon)),
    }
    exif_ifd = {
        piexif.ExifIFD.DateTimeOriginal: date.strftime("%Y:%m:%d %H:%M:%S").encode(),
    }
    exif_dict = {"GPS": gps_ifd, "Exif": exif_ifd}
    return piexif.dump(exif_dict)


def _generate_photo(
    path: Path,
    location: dict,
    date: datetime,
    quality: str = "good",
):
    """Generate a synthetic image with embedded EXIF metadata."""
    size = (1200, 900)
    # Base color varies by location
    base_colors = {
        "Paris":   (180, 160, 130),
        "Tokyo":   (130, 170, 160),
        "NewYork": (150, 150, 170),
    }
    color = base_colors.get(location["name"], (160, 160, 160))

    img = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(img)

    # Draw simple geometric shapes to create variation
    for _ in range(random.randint(3, 10)):
        x0 = random.randint(0, size[0])
        y0 = random.randint(0, size[1])
        x1 = x0 + random.randint(50, 300)
        y1 = y0 + random.randint(50, 200)
        r, g, b = [max(0, min(255, c + random.randint(-60, 60))) for c in color]
        draw.rectangle([x0, y0, x1, y1], fill=(r, g, b))

    # Simulate quality degradation
    if quality == "blurry":
        img = img.filter(ImageFilter.GaussianBlur(radius=8))
    elif quality == "dark":
        img = img.point(lambda p: p * 0.3)
    elif quality == "overexposed":
        img = img.point(lambda p: min(255, p * 2.5))

    exif_bytes = _write_exif(location["lat"], location["lon"], date)

    img.save(path, "JPEG", quality=90, exif=exif_bytes)


def generate_gallery(out_dir: str, total_count: int = 40, seed: int = 42):
    random.seed(seed)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    base_date = datetime(2024, 8, 1, 10, 0, 0)
    qualities = ["good", "good", "good", "blurry", "dark", "overexposed"]

    print(f"Generating {total_count} photos in {out} ...")
    generated = 0

    for i in range(total_count):
        loc = random.choice(LOCATIONS)
        # Jitter GPS slightly within the same city (~0.2km)
        jitter_lat = loc["lat"] + random.uniform(-0.002, 0.002)
        jitter_lon = loc["lon"] + random.uniform(-0.002, 0.002)
        jittered_loc = {**loc, "lat": jitter_lat, "lon": jitter_lon}

        date = base_date + timedelta(hours=i * 2, minutes=random.randint(0, 59))
        quality = random.choice(qualities)

        fname = f"{loc['name']}_{i:03d}_{quality}.jpg"
        path = out / fname
        _generate_photo(path, jittered_loc, date, quality)
        generated += 1

        if i % 10 == 9:
            print(f"  {generated}/{total_count} done...")

    # Add some duplicates (same image, different filename)
    originals = list(out.glob("*.jpg"))[:5]
    for i, orig in enumerate(originals):
        dup = out / f"DUPLICATE_{i:02d}_{orig.name}"
        import shutil
        shutil.copy2(orig, dup)
        print(f"  Created duplicate: {dup.name}")

    print(f"\nDone! {generated} photos + {len(originals)} duplicates in: {out}")
    print("Run the pipeline with:")
    print(f"  python main.py --cli --folder {out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a fake photo gallery for testing")
    parser.add_argument("--out", default="/tmp/test_gallery", help="Output directory")
    parser.add_argument("--count", type=int, default=40, help="Number of photos to generate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    generate_gallery(args.out, args.count, args.seed)
