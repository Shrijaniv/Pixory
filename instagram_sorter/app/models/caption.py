from dataclasses import dataclass, field
from typing import List


@dataclass
class Caption:
    text: str
    mood: str
    hashtags: List[str] = field(default_factory=list)
    chosen: bool = False

    def formatted(self) -> str:
        """Return caption text with hashtags appended."""
        if self.hashtags:
            tags = " ".join(f"#{h.lstrip('#')}" for h in self.hashtags)
            return f"{self.text}\n\n{tags}"
        return self.text
