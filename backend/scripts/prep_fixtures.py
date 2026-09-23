#!/usr/bin/env python3
"""
Turn a folder of real photos into the exact JPEGs the app would send.

The mobile app never ships originals to the sidecar. `scoreWithBackend`
resizes to 512px wide and re-encodes at JPEG quality 70 before POSTing, so
benchmarking or testing against full-resolution HEIC originals measures the
wrong thing entirely. This script reproduces that step so local verification
matches production bytes.

HEIC needs a decoder OpenCV does not have. macOS ships `sips`, which is used
when available; otherwise `pillow-heif` is tried. JPEG/PNG inputs go straight
through Pillow.

Usage:
    python scripts/prep_fixtures.py ../fixtures/library ../fixtures/prepared/library
    python scripts/prep_fixtures.py ../fixtures/identity ../fixtures/prepared/identity --width 1024

Fixtures are gitignored: this script is tooling, the photos are never committed.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# Matches lib/photos/scoring.ts: resize width 512, compress 0.7.
DEFAULT_WIDTH = 512
DEFAULT_QUALITY = 70

HEIC_SUFFIXES = {".heic", ".heif"}
PASSTHROUGH_SUFFIXES = {".jpg", ".jpeg", ".png"}


def _decode_heic_with_sips(src: Path, dest: Path) -> bool:
    """Convert HEIC to PNG via macOS `sips`. Returns False if sips is absent."""
    if not shutil.which("sips"):
        return False
    result = subprocess.run(
        ["sips", "-s", "format", "png", str(src), "--out", str(dest)],
        capture_output=True,
    )
    return result.returncode == 0 and dest.exists()


def _decode_heic_with_pillow(src: Path):
    """Fall back to pillow-heif where it is installed (Linux/CI)."""
    try:
        import pillow_heif  # type: ignore
    except ImportError:
        return None
    heif = pillow_heif.read_heif(str(src))
    from PIL import Image

    return Image.frombytes(heif.mode, heif.size, heif.data)


def load_image(src: Path):
    """Open any supported photo as a PIL RGB image, or None if undecodable."""
    from PIL import Image

    suffix = src.suffix.lower()

    if suffix in HEIC_SUFFIXES:
        with tempfile.TemporaryDirectory() as tmp:
            png = Path(tmp) / "decoded.png"
            if _decode_heic_with_sips(src, png):
                return Image.open(png).convert("RGB")
        img = _decode_heic_with_pillow(src)
        return img.convert("RGB") if img is not None else None

    if suffix in PASSTHROUGH_SUFFIXES:
        return Image.open(src).convert("RGB")

    return None


def prepare(src_dir: Path, out_dir: Path, width: int, quality: int) -> tuple[int, int]:
    out_dir.mkdir(parents=True, exist_ok=True)
    converted = skipped = 0

    files = sorted(p for p in src_dir.iterdir() if p.is_file() and not p.name.startswith("."))
    for i, src in enumerate(files, 1):
        img = load_image(src)
        if img is None:
            print(f"  [{i}/{len(files)}] skip {src.name} (undecodable)")
            skipped += 1
            continue

        # Preserve aspect ratio, matching ImageManipulator's resize-by-width.
        w, h = img.size
        if w != width:
            img = img.resize((width, max(1, round(h * width / w))))

        dest = out_dir / f"{src.stem}.jpg"
        img.save(dest, "JPEG", quality=quality)
        converted += 1
        if i % 20 == 0 or i == len(files):
            print(f"  [{i}/{len(files)}] {converted} converted, {skipped} skipped")

    return converted, skipped


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("src", type=Path, help="folder of original photos")
    parser.add_argument("out", type=Path, help="folder to write prepared JPEGs into")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--quality", type=int, default=DEFAULT_QUALITY)
    args = parser.parse_args()

    if not args.src.is_dir():
        print(f"error: {args.src} is not a directory", file=sys.stderr)
        return 1

    print(f"Preparing {args.src} -> {args.out} at {args.width}px / q{args.quality}")
    converted, skipped = prepare(args.src, args.out, args.width, args.quality)
    print(f"Done: {converted} converted, {skipped} skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
