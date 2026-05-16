import base64
import json
import math
from typing import List

from app.models.caption import Caption
from app.models.photo import Photo
from app.utils.image_utils import build_thumbnail_grid

MOODS = ["wanderlust", "minimal", "story", "playful"]

_PROMPT_TEMPLATE = """You are a creative social media copywriter specializing in travel and lifestyle Instagram content.

I have {n} photos from {location_str}{date_part}.

Generate exactly 4 Instagram captions — one for each mood below. Each caption should:
- Be authentic and engaging, not generic
- Be 1-3 sentences max
- Include 5-8 relevant hashtags at the end
- Feel distinctly different in tone

Moods:
1. wanderlust — inspiring, evocative travel writing
2. minimal — short, poetic, leaves things unsaid
3. story — narrative, personal, like telling a friend
4. playful — light, fun, maybe a bit witty

Return ONLY valid JSON in this exact format (no markdown, no code fences):
[
  {{"mood": "wanderlust", "text": "...", "hashtags": ["tag1", "tag2"]}},
  {{"mood": "minimal",    "text": "...", "hashtags": ["tag1", "tag2"]}},
  {{"mood": "story",      "text": "...", "hashtags": ["tag1", "tag2"]}},
  {{"mood": "playful",    "text": "...", "hashtags": ["tag1", "tag2"]}}
]"""


def _build_prompt(photos: List[Photo]) -> str:
    places = list({
        p.place_name for p in photos
        if p.place_name and p.place_name not in ("Unknown Location", "Unknown")
    })
    dates = [p.date for p in photos if p.date]

    location_str = ", ".join(places) if places else "various locations"

    date_part = ""
    if dates:
        min_d = min(dates).strftime("%B %d, %Y")
        max_d = max(dates).strftime("%B %d, %Y")
        date_part = f" taken on {min_d}" if min_d == max_d else f" taken {min_d} – {max_d}"

    return _PROMPT_TEMPLATE.format(
        n=len(photos),
        location_str=location_str,
        date_part=date_part,
    )


def generate_captions(photos: List[Photo], openai_service) -> List[Caption]:
    """
    Generate 4 caption variants (one per mood) using GPT-4o Vision.
    Sends a thumbnail grid of selected photos alongside the text prompt.
    Falls back to text-only if the vision call fails.
    """
    prompt = _build_prompt(photos)

    # Build thumbnail grid for visual context
    try:
        grid_bytes = build_thumbnail_grid([p.path for p in photos])
        b64_image = base64.b64encode(grid_bytes).decode()
        raw = openai_service.chat_with_vision(
            prompt=prompt,
            image_b64=b64_image,
            image_media_type="image/jpeg",
        )
    except Exception:
        # Fallback: text-only prompt
        raw = openai_service.chat(prompt)

    return _parse_captions(raw)


def _parse_captions(raw: str) -> List[Caption]:
    """Parse GPT JSON response into Caption objects. Falls back gracefully."""
    try:
        # Strip accidental markdown code fences
        cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(cleaned)
        return [
            Caption(
                text=item["text"],
                mood=item["mood"],
                hashtags=item.get("hashtags", []),
            )
            for item in data
        ]
    except (json.JSONDecodeError, KeyError, TypeError):
        # Return raw text as a single fallback caption
        return [Caption(text=raw.strip(), mood="auto", hashtags=[])]
