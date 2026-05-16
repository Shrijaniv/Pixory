"""Tests for the deduplication pipeline step."""
import io
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest
from PIL import Image

from app.models.photo import Photo
from app.core.deduplicator import remove_duplicates, _compute_hash


def _make_photo(name: str, width: int = 1000, height: int = 1000) -> Photo:
    return Photo(path=Path(f"/fake/{name}.jpg"), width=width, height=height)


def _make_solid_image(color: tuple = (255, 0, 0), size: tuple = (100, 100)) -> Image.Image:
    return Image.new("RGB", size, color)


class TestComputeHash:
    def test_sets_phash_on_success(self, tmp_path):
        img = _make_solid_image()
        p = tmp_path / "test.jpg"
        img.save(p)

        photo = Photo(path=p)
        result = _compute_hash(photo)

        assert result.phash is not None
        assert len(result.phash) > 0

    def test_sets_none_on_unreadable_file(self, tmp_path):
        p = tmp_path / "bad.jpg"
        p.write_bytes(b"not an image")

        photo = Photo(path=p)
        result = _compute_hash(photo)

        assert result.phash is None


class TestRemoveDuplicates:
    def test_keeps_unique_photos(self, tmp_path):
        # Use visually distinct images — pHash needs structural differences, not just color
        from PIL import ImageDraw
        def _patterned(cell_size: int) -> Image.Image:
            img = Image.new("RGB", (256, 256), (255, 255, 255))
            draw = ImageDraw.Draw(img)
            for i in range(0, 256, cell_size * 2):
                for j in range(0, 256, cell_size * 2):
                    draw.rectangle([i, j, i + cell_size, j + cell_size], fill=(0, 0, 0))
            return img

        img_a = tmp_path / "fine_grid.jpg"
        img_b = tmp_path / "coarse_grid.jpg"
        _patterned(4).save(img_a)   # fine checkerboard
        _patterned(64).save(img_b)  # coarse checkerboard — structurally very different

        photos = [Photo(path=img_a), Photo(path=img_b)]
        result = remove_duplicates(photos)

        assert len(result) == 2

    def test_removes_identical_duplicate(self, tmp_path):
        original = tmp_path / "orig.jpg"
        copy = tmp_path / "copy.jpg"
        img = _make_solid_image((200, 100, 50))
        img.save(original)
        img.save(copy)

        photos = [
            Photo(path=original, width=2000, height=2000),
            Photo(path=copy, width=500, height=500),
        ]
        result = remove_duplicates(photos)

        assert len(result) == 1

    def test_keeps_photo_when_hash_fails(self, tmp_path):
        bad = tmp_path / "bad.jpg"
        bad.write_bytes(b"garbage")

        photos = [Photo(path=bad)]
        result = remove_duplicates(photos)

        assert len(result) == 1

    def test_prefers_higher_resolution_on_duplicate(self, tmp_path):
        img = _make_solid_image((100, 200, 50))
        lo = tmp_path / "lo.jpg"
        hi = tmp_path / "hi.jpg"
        img.save(lo)
        img.save(hi)

        photos = [
            Photo(path=lo, width=500, height=500),
            Photo(path=hi, width=3000, height=3000),
        ]
        result = remove_duplicates(photos)

        assert len(result) == 1
        assert result[0].path == hi
