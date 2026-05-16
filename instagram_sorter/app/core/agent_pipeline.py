"""
Claude-powered agentic photo pipeline.
Uses Anthropic tool use — Claude decides how to curate photos autonomously.
"""

from pathlib import Path
from typing import Callable, Optional

from app.core.pipeline_tools import (
    PhotoCache,
    make_tool_executor,
    to_anthropic_tools,
)
from app.models.caption import Caption
from app.models.photo import Photo
from app.services.claude_service import ClaudeService
from app.config.settings import MAX_CAROUSEL_PHOTOS

_SYSTEM_PROMPT = f"""You are an expert photo curator and social media strategist specializing in Instagram content.

Your job is to:
1. Scan a folder of photos and understand what's there
2. Remove duplicates so you're not working with redundant shots
3. Visually inspect photos — look at actual quality (sharpness, lighting, composition, subject matter)
4. Select the BEST {MAX_CAROUSEL_PHOTOS} photos maximum for an Instagram carousel post
   - Prioritize: sharp focus, good exposure, interesting composition, emotional impact
   - Ensure geographic diversity — cover multiple locations if photos span multiple places
   - Tell a coherent visual story from start to finish
5. Write 4 caption variants with different moods: wanderlust, minimal, story, playful
6. Call finalize_selection with your chosen photos and captions

Be decisive. Think out loud as you inspect photos. Explain why you include or exclude each one."""


class AgentPipelineResult:
    def __init__(self, selected: list[Photo], captions: list[Caption], notes: str = ""):
        self.selected = selected
        self.captions = captions
        self.curation_notes = notes


def run_agent_pipeline(
    folder: str,
    claude_service: ClaudeService,
    on_thinking: Optional[Callable[[str], None]] = None,
    on_progress: Optional[Callable[[str], None]] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    vibe: Optional[str] = None,
) -> AgentPipelineResult:
    cache = PhotoCache()
    tool_executor_raw = make_tool_executor(cache, on_progress=on_progress)

    def tool_executor(tool_name: str, tool_input: dict):
        result = tool_executor_raw(tool_name, tool_input)
        # Convert neutral image blocks to Anthropic format
        if isinstance(result, list):
            return _to_anthropic_blocks(result)
        return result

    constraints = []
    if date_from or date_to:
        date_range = f"{date_from or 'any'} to {date_to or 'any'}"
        constraints.append(f"Only include photos taken between {date_range}. Skip any photos outside this range.")
    if vibe:
        constraints.append(
            f"The user wants photos that match this vibe/theme: \"{vibe}\". "
            f"Prioritize photos that fit this mood and tell a story around it. "
            f"Write captions that reflect this theme."
        )

    constraint_text = ("\n\nIMPORTANT CONSTRAINTS:\n" + "\n".join(f"- {c}" for c in constraints)) if constraints else ""

    user_message = (
        f"Please curate the best Instagram carousel post from the photos in this folder:\n"
        f"{folder}\n\n"
        f"Start by scanning the gallery, deduplicate, then visually inspect the photos "
        f"and select the best ones (max {MAX_CAROUSEL_PHOTOS}). "
        f"Make sure to cover multiple locations if the photos span different places. "
        f"Then write 4 captions and call finalize_selection."
        f"{constraint_text}"
    )

    output = claude_service.run_agent(
        system=_SYSTEM_PROMPT,
        user_message=user_message,
        tools=to_anthropic_tools(),
        tool_executor=tool_executor,
        on_thinking=on_thinking,
    )

    return _parse_result(output, cache)


def _to_anthropic_blocks(blocks: list) -> list:
    """Convert neutral image blocks to Anthropic content block format."""
    result = []
    for block in blocks:
        if block.get("type") == "image":
            result.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": block["media_type"],
                    "data": block["data"],
                },
            })
        elif block.get("type") == "text":
            result.append({"type": "text", "text": block["text"]})
    return result


def _parse_result(output: dict, cache: PhotoCache) -> AgentPipelineResult:
    result = output.get("result")
    if not result:
        raise RuntimeError("Claude did not call finalize_selection.")

    selected_photos: list[Photo] = []
    for path_str in result.get("selected_photo_paths", []):
        photo = cache.get(path_str) or Photo(path=Path(path_str))
        photo.selected = True
        selected_photos.append(photo)

    captions = [
        Caption(
            mood=c.get("mood", "auto"),
            text=c.get("text", ""),
            hashtags=c.get("hashtags", []),
        )
        for c in result.get("captions", [])
    ]

    return AgentPipelineResult(
        selected=selected_photos,
        captions=captions,
        notes=result.get("curation_notes", ""),
    )
