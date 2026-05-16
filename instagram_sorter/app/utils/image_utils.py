import io
import math
from pathlib import Path
from typing import List

from PIL import Image


def make_thumbnail(path: Path, max_dim: int = 800) -> "Image.Image":
    """Open an image and resize it to fit within max_dim, preserving aspect ratio."""
    img = Image.open(path)
    img.thumbnail((max_dim, max_dim), Image.LANCZOS)
    return img.convert("RGB")


def build_thumbnail_grid(paths: List[Path], grid_size: int = 512) -> bytes:
    """
    Arrange thumbnails into a square grid and return as JPEG bytes.
    Used for sending a photo collage to the vision API.
    """
    n = len(paths)
    if n == 0:
        return b""

    cols = min(4, n)
    rows = math.ceil(n / cols)
    cell_size = grid_size // cols

    grid = Image.new("RGB", (cols * cell_size, rows * cell_size), (30, 30, 30))

    for i, path in enumerate(paths):
        row, col = divmod(i, cols)
        try:
            with Image.open(path) as img:
                img.thumbnail((cell_size, cell_size), Image.LANCZOS)
                img = img.convert("RGB")
                # Center the thumbnail in the cell
                x_offset = col * cell_size + (cell_size - img.width) // 2
                y_offset = row * cell_size + (cell_size - img.height) // 2
                grid.paste(img, (x_offset, y_offset))
        except Exception:
            pass

    buf = io.BytesIO()
    grid.save(buf, format="JPEG", quality=75)
    return buf.getvalue()
