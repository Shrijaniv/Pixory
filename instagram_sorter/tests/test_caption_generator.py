"""Tests for the caption generation and parsing logic."""
import json
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.models.photo import Photo
from app.models.caption import Caption
from app.core.caption_generator import generate_captions, _parse_captions, _build_prompt

VALID_JSON = json.dumps([
    {"mood": "wanderlust", "text": "Chasing horizons.", "hashtags": ["travel", "explore"]},
    {"mood": "minimal",    "text": "Just be.",           "hashtags": ["minimal"]},
    {"mood": "story",      "text": "We got lost.",        "hashtags": ["story", "adventure"]},
    {"mood": "playful",    "text": "No wifi, no problem!","hashtags": ["fun"]},
])


def _make_photo(place: str = "Paris, France", date: datetime = None) -> Photo:
    p = Photo(path=Path("/fake/photo.jpg"))
    p.place_name = place
    p.date = date or datetime(2024, 7, 15)
    return p


class TestParseCapitions:
    def test_parses_valid_json(self):
        captions = _parse_captions(VALID_JSON)
        assert len(captions) == 4
        assert all(isinstance(c, Caption) for c in captions)
        assert captions[0].mood == "wanderlust"
        assert "travel" in captions[0].hashtags

    def test_strips_markdown_code_fences(self):
        fenced = f"```json\n{VALID_JSON}\n```"
        captions = _parse_captions(fenced)
        assert len(captions) == 4

    def test_falls_back_on_invalid_json(self):
        captions = _parse_captions("Sorry, I cannot do that.")
        assert len(captions) == 1
        assert captions[0].mood == "auto"

    def test_falls_back_on_missing_keys(self):
        bad = json.dumps([{"mood": "wanderlust"}])  # missing 'text'
        captions = _parse_captions(bad)
        assert len(captions) == 1
        assert captions[0].mood == "auto"


class TestBuildPrompt:
    def test_includes_location(self):
        photos = [_make_photo("Rome, Italy"), _make_photo("Venice, Italy")]
        prompt = _build_prompt(photos)
        assert "Rome" in prompt or "Venice" in prompt

    def test_includes_photo_count(self):
        photos = [_make_photo() for _ in range(5)]
        prompt = _build_prompt(photos)
        assert "5 photos" in prompt

    def test_handles_no_gps_photos(self):
        p = Photo(path=Path("/fake/photo.jpg"))
        p.place_name = "Unknown Location"
        prompt = _build_prompt([p])
        assert "various locations" in prompt


class TestGenerateCaptions:
    def test_calls_openai_and_returns_captions(self, tmp_path):
        # Create a real tiny image so build_thumbnail_grid works
        from PIL import Image
        img_path = tmp_path / "photo.jpg"
        Image.new("RGB", (50, 50), (100, 150, 200)).save(img_path)

        photo = Photo(path=img_path)
        photo.place_name = "Tokyo, Japan"
        photo.date = datetime(2024, 3, 20)

        mock_service = MagicMock()
        mock_service.chat_with_vision.return_value = VALID_JSON

        captions = generate_captions([photo], mock_service)

        assert len(captions) == 4
        mock_service.chat_with_vision.assert_called_once()

    def test_falls_back_to_text_on_vision_error(self, tmp_path):
        from PIL import Image
        img_path = tmp_path / "photo.jpg"
        Image.new("RGB", (50, 50)).save(img_path)

        photo = Photo(path=img_path)

        mock_service = MagicMock()
        mock_service.chat_with_vision.side_effect = Exception("API error")
        mock_service.chat.return_value = VALID_JSON

        captions = generate_captions([photo], mock_service)

        assert len(captions) == 4
        mock_service.chat.assert_called_once()
