import json
from typing import Any, Callable, Optional

from openai import OpenAI

from app.config.settings import OPENAI_API_KEY


class OpenAIService:
    """Wrapper around the OpenAI SDK for text, vision, and tool-use agent loops."""

    def __init__(self, api_key: str = None):
        self.client = OpenAI(api_key=api_key or OPENAI_API_KEY)

    def chat_with_vision(
        self,
        prompt: str,
        image_b64: str,
        image_media_type: str = "image/jpeg",
    ) -> str:
        """Send a prompt + base64-encoded image to GPT-4o Vision."""
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{image_media_type};base64,{image_b64}",
                                "detail": "low",
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
            max_tokens=1200,
        )
        return response.choices[0].message.content

    def chat(self, prompt: str) -> str:
        """Send a text-only prompt to GPT-4o Mini (cheaper fallback)."""
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
        )
        return response.choices[0].message.content

    # ------------------------------------------------------------------
    # Agentic tool-use loop
    # ------------------------------------------------------------------

    def run_agent(
        self,
        system: str,
        user_message: str,
        tools: list[dict],
        tool_executor: Callable,
        on_thinking: Optional[Callable[[str], None]] = None,
    ) -> dict:
        """
        Run a tool-use agentic loop until GPT-4o stops calling tools.

        Args:
            system:        System prompt.
            user_message:  Initial user message.
            tools:         OpenAI function-calling tool dicts.
            tool_executor: Callable(tool_name, tool_input) -> result.
            on_thinking:   Called with assistant text as it arrives.

        Returns:
            dict with 'result' (finalize_selection payload) and 'messages'.
        """
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_message},
        ]
        final_result = None

        while True:
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                tools=tools,
                tool_choice="auto",
                max_tokens=4096,
            )

            choice = response.choices[0]
            msg = choice.message
            messages.append(msg.model_dump(exclude_none=True))

            if msg.content and on_thinking:
                on_thinking(msg.content)

            if choice.finish_reason == "stop" or not msg.tool_calls:
                break

            tool_results = []
            # Images must be sent as a user message, not inside tool results.
            # Collect any image blocks here and inject them after tool results.
            deferred_images = []

            for tc in msg.tool_calls:
                tool_name = tc.function.name
                tool_input = json.loads(tc.function.arguments)

                if tool_name == "finalize_selection":
                    final_result = tool_input
                    tool_results.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": "Selection finalized. Pipeline complete.",
                    })
                    messages.extend(tool_results)
                    return {"result": final_result, "messages": messages}

                try:
                    raw = tool_executor(tool_name, tool_input)
                    text_content, image_blocks = _split_content(raw)
                except Exception as e:
                    text_content = f"Error executing {tool_name}: {e}"
                    image_blocks = []

                tool_results.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": text_content,
                })
                deferred_images.extend(image_blocks)

            messages.extend(tool_results)

            # Inject images as a user message so OpenAI accepts them
            if deferred_images:
                messages.append({
                    "role": "user",
                    "content": deferred_images,
                })

        return {"result": final_result, "messages": messages}


def _split_content(raw: Any) -> tuple[str, list]:
    """
    Separate neutral tool output into:
      - text_content: str for the tool result message
      - image_blocks: list of OpenAI image_url dicts to send as a user message
    OpenAI only allows image_url content in user-role messages.
    """
    if isinstance(raw, str):
        return raw, []

    if isinstance(raw, list):
        text_parts = []
        image_blocks = []
        for block in raw:
            if block.get("type") == "image":
                media_type = block.get("media_type", "image/jpeg")
                image_blocks.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{media_type};base64,{block['data']}",
                        "detail": "low",
                    },
                })
            elif block.get("type") == "text":
                text_parts.append(block["text"])
        text_content = "\n".join(text_parts) if text_parts else "See images."
        return text_content, image_blocks

    return str(raw), []
