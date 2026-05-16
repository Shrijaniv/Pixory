import anthropic
from typing import Any

from app.config.settings import ANTHROPIC_API_KEY


class ClaudeService:
    """
    Thin wrapper around the Anthropic SDK.
    Supports vision messages and tool-use (agentic) loops.
    """

    def __init__(self, api_key: str = None, model: str = "claude-opus-4-6"):
        self.client = anthropic.Anthropic(api_key=api_key or ANTHROPIC_API_KEY)
        self.model = model

    # ------------------------------------------------------------------
    # Simple vision call (for caption generation, same as OpenAI path)
    # ------------------------------------------------------------------

    def chat_with_vision(
        self,
        prompt: str,
        image_b64: str,
        image_media_type: str = "image/jpeg",
    ) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1200,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": image_media_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        return response.content[0].text

    def chat(self, prompt: str) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text

    # ------------------------------------------------------------------
    # Agentic tool-use loop
    # ------------------------------------------------------------------

    def run_agent(
        self,
        system: str,
        user_message: str,
        tools: list[dict],
        tool_executor,
        on_thinking: callable = None,
    ) -> dict:
        """
        Run a tool-use agentic loop until Claude stops calling tools.

        Args:
            system:        System prompt defining Claude's role.
            user_message:  Initial user message to start the loop.
            tools:         List of Anthropic tool dicts (name, description, input_schema).
            tool_executor: Callable(tool_name, tool_input) -> any. Executes a tool and returns result.
            on_thinking:   Optional callback(str) called with Claude's text output as it thinks.

        Returns:
            dict with keys: 'result' (final tool call payload), 'messages' (full conversation)
        """
        messages = [{"role": "user", "content": user_message}]
        final_result = None

        while True:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=system,
                tools=tools,
                messages=messages,
            )

            # Collect Claude's response into messages
            assistant_content = []
            for block in response.content:
                assistant_content.append(block)
                if block.type == "text" and on_thinking:
                    on_thinking(block.text)

            messages.append({"role": "assistant", "content": assistant_content})

            # Stop if Claude is done
            if response.stop_reason == "end_turn":
                break

            # Process all tool calls Claude made this turn
            tool_results = []
            for block in response.content:
                if block.type != "tool_use":
                    continue

                tool_name = block.name
                tool_input = block.input

                # The finalize_selection tool signals end-of-pipeline
                if tool_name == "finalize_selection":
                    final_result = tool_input
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": "Selection finalized. Pipeline complete.",
                    })
                    # Append results and break out of the loop
                    messages.append({"role": "user", "content": tool_results})
                    return {"result": final_result, "messages": messages}

                # Execute all other tools
                try:
                    result = tool_executor(tool_name, tool_input)
                    # Tool results can include image content blocks
                    if isinstance(result, list):
                        content = result
                    else:
                        content = str(result)
                except Exception as e:
                    content = f"Error executing {tool_name}: {e}"

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": content,
                })

            messages.append({"role": "user", "content": tool_results})

        return {"result": final_result, "messages": messages}
