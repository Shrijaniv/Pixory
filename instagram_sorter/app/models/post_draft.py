from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional

from app.models.caption import Caption
from app.models.photo import Photo


@dataclass
class PostDraft:
    photos: List[Photo]
    caption: Optional[Caption] = None
    status: str = "draft"  # draft | approved | publishing | published | failed
    instagram_post_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    published_at: Optional[datetime] = None

    def approve(self):
        self.status = "approved"

    def mark_published(self, post_id: str):
        self.status = "published"
        self.instagram_post_id = post_id
        self.published_at = datetime.now()

    def mark_failed(self):
        self.status = "failed"
