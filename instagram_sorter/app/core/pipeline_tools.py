"""
Shared tool definitions and executor for both Claude and OpenAI agent pipelines.

Tool specs are defined once in a neutral format, then converted to each
provider's expected schema by `to_anthropic_tools()` / `to_openai_tools()`.
The tool executor is provider-agnostic.
"""

import base64
import json
from pathlib import Path
from typing import Any, Callable, Optional

from app.core.deduplicator import remove_duplicates
from app.core.gallery_scanner import scan_gallery
from app.models.photo import Photo
from app.config.settings import MAX_CAROUSEL_PHOTOS

# ── Neutral tool spec format ──────────────────────────────────────────────────
# Each entry: {name, description, parameters}  (parameters = JSON Schema object)

TOOL_SPECS = [
    {
        "name": "scan_gallery",
        "description": (
            "Scan a local folder for all photos. Returns a list of photos with their "
            "file path, capture date, GPS coordinates, and file size. "
            "Always call this first."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "folder_path": {
                    "type": "string",
                    "description": "Absolute path to the photo folder to scan.",
                }
            },
            "required": ["folder_path"],
        },
    },
    {
        "name": "deduplicate",
        "description": (
            "Remove near-duplicate photos using perceptual hashing. "
            "The highest-resolution copy of each duplicate group is kept. "
            "Pass the full list of photo paths returned by scan_gallery."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "photo_paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of absolute file paths to deduplicate.",
                }
            },
            "required": ["photo_paths"],
        },
    },
    {
        "name": "view_photo",
        "description": (
            "View a single photo so you can visually assess its quality, composition, "
            "sharpness, lighting, and subject. Call this to inspect candidates before "
            "deciding to include or exclude them."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "photo_path": {
                    "type": "string",
                    "description": "Absolute path to the photo file to view.",
                }
            },
            "required": ["photo_path"],
        },
    },
    {
        "name": "view_photos_grid",
        "description": (
            "View multiple photos at once as a thumbnail grid — useful for a quick "
            "overview of a batch. Pass up to 20 photo paths."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "photo_paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Up to 20 photo paths to view as a grid.",
                }
            },
            "required": ["photo_paths"],
        },
    },
    {
        "name": "finalize_selection",
        "description": (
            f"Call this when you have made your final photo selection and written captions. "
            f"This ends the pipeline. You MUST call this to complete the workflow."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "selected_photo_paths": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        f"Ordered list of selected photo paths (max {MAX_CAROUSEL_PHOTOS}). "
                        "Order chronologically or for best storytelling flow."
                    ),
                },
                "captions": {
                    "type": "array",
                    "description": "Exactly 4 caption variants.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "mood": {
                                "type": "string",
                                "enum": ["wanderlust", "minimal", "story", "playful"],
                            },
                            "text": {"type": "string"},
                            "hashtags": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["mood", "text", "hashtags"],
                    },
                },
                "curation_notes": {
                    "type": "string",
                    "description": "Brief explanation of your selection rationale for the user.",
                },
            },
            "required": ["selected_photo_paths", "captions"],
        },
    },
]


# ── Schema converters ─────────────────────────────────────────────────────────

def to_anthropic_tools() -> list[dict]:
    """Convert neutral specs to Anthropic tool format (input_schema key)."""
    return [
        {
            "name": spec["name"],
            "description": spec["description"],
            "input_schema": spec["parameters"],
        }
        for spec in TOOL_SPECS
    ]


def to_openai_tools() -> list[dict]:
    """Convert neutral specs to OpenAI function-calling format."""
    return [
        {
            "type": "function",
            "function": {
                "name": spec["name"],
                "description": spec["description"],
                "parameters": spec["parameters"],
            },
        }
        for spec in TOOL_SPECS
    ]


# ── Photo cache ───────────────────────────────────────────────────────────────

class PhotoCache:
    def __init__(self):
        self._photos: dict[str, Photo] = {}

    def store(self, photos: list[Photo]):
        for p in photos:
            self._photos[str(p.path)] = p

    def get(self, path_str: str) -> Optional[Photo]:
        return self._photos.get(path_str)

    def get_many(self, paths: list[str]) -> list[Photo]:
        return [self._photos[p] for p in paths if p in self._photos]


# ── Tool executor ─────────────────────────────────────────────────────────────

def make_tool_executor(
    cache: PhotoCache,
    on_progress: Optional[Callable[[str], None]] = None,
) -> Callable:
    """
    Returns a function: (tool_name, tool_input) -> result.

    For view_photo / view_photos_grid, result is a list of content blocks
    (text + image) that both Claude and OpenAI can consume.
    The image block format matches Claude's; the OpenAI pipeline converts it.
    """

    def _progress(msg: str):
        if on_progress:
            on_progress(msg)

    def execute(tool_name: str, tool_input: dict) -> Any:

        if tool_name == "scan_gallery":
            folder = tool_input["folder_path"]
            _progress(f"Scanning gallery: {folder}")
            photos = scan_gallery(folder)
            _progress(f"Found {len(photos)} photos — deduplicating...")
            photos = remove_duplicates(photos)
            _progress(f"{len(photos)} unique photos ready")
            cache.store(photos)
            rows = [
                {
                    "path": str(p.path),
                    "name": p.path.name,
                    "date": p.date.isoformat() if p.date else None,
                    "lat": p.lat,
                    "lon": p.lon,
                    "width": p.width,
                    "height": p.height,
                    "size_kb": round(p.file_size / 1024, 1),
                }
                for p in photos
            ]
            return json.dumps({
                "total": len(photos),
                "note": "Duplicates have been removed automatically.",
                "photos": rows,
            }, default=str)

        elif tool_name == "deduplicate":
            paths = tool_input["photo_paths"]
            _progress(f"Deduplicating {len(paths)} photos...")
            photos = cache.get_many(paths) or [Photo(path=Path(p)) for p in paths]
            unique = remove_duplicates(photos)
            cache.store(unique)
            _progress(f"{len(unique)} unique photos")
            return json.dumps({
                "unique_count": len(unique),
                "removed": len(paths) - len(unique),
                "unique_paths": [str(p.path) for p in unique],
            })

        elif tool_name == "view_photo":
            path_str = tool_input["photo_path"]
            _progress(f"Viewing: {Path(path_str).name}")
            return _load_image_blocks(path_str)

        elif tool_name == "view_photos_grid":
            paths = tool_input["photo_paths"][:20]
            _progress(f"Building grid for {len(paths)} photos...")
            try:
                from app.utils.image_utils import build_thumbnail_grid
                grid_bytes = build_thumbnail_grid([Path(p) for p in paths])
                b64 = base64.standard_b64encode(grid_bytes).decode()
                names = "\n".join(f"{i+1}. {Path(p).name}" for i, p in enumerate(paths))
                return [
                    {"type": "image", "media_type": "image/jpeg", "data": b64},
                    {"type": "text", "text": f"Grid of {len(paths)} photos:\n{names}"},
                ]
            except Exception as e:
                return f"Could not build grid: {e}"

        else:
            return f"Unknown tool: {tool_name}"

    return execute


def _load_image_blocks(path_str: str) -> Any:
    """Load a photo and return neutral image content blocks."""
    try:
        import io
        from PIL import Image
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
        except ImportError:
            pass
        with Image.open(path_str) as img:
            img.thumbnail((1024, 1024))
            img = img.convert("RGB")
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85)
            b64 = base64.standard_b64encode(buf.getvalue()).decode()
        return [
            {"type": "image", "media_type": "image/jpeg", "data": b64},
            {"type": "text", "text": f"Photo: {Path(path_str).name}"},
        ]
    except Exception as e:
        return f"Could not open image: {e}"
