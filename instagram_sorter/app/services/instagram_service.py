from typing import List, Optional

from app.models.caption import Caption
from app.models.photo import Photo
from app.config.settings import (
    INSTAGRAM_USERNAME,
    INSTAGRAM_PASSWORD,
    INSTAGRAM_ACCESS_TOKEN,
    INSTAGRAM_BUSINESS_ACCOUNT_ID,
)


class InstagramService:
    """
    Abstraction over two Instagram publishing backends:
      - "instagrapi"  : unofficial library, works with personal accounts (dev/testing)
      - "graph_api"   : official Meta Graph API, requires a Business/Creator account

    Switch via the `mode` constructor argument or by setting INSTAGRAM_MODE in .env.
    """

    def __init__(self, mode: str = "instagrapi"):
        if mode not in ("instagrapi", "graph_api"):
            raise ValueError(f"Unknown mode '{mode}'. Use 'instagrapi' or 'graph_api'.")
        self.mode = mode
        self._client = None

    # ------------------------------------------------------------------
    # Authentication
    # ------------------------------------------------------------------

    def login(self, username: str = None, password: str = None):
        username = username or INSTAGRAM_USERNAME
        password = password or INSTAGRAM_PASSWORD

        if self.mode == "instagrapi":
            from instagrapi import Client

            self._client = Client()
            self._client.login(username, password)
        else:
            # Graph API uses a long-lived access token — no login needed here
            if not INSTAGRAM_ACCESS_TOKEN:
                raise RuntimeError(
                    "INSTAGRAM_ACCESS_TOKEN must be set in .env for graph_api mode."
                )

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    def publish_carousel(self, photos: List[Photo], caption: Caption) -> Optional[str]:
        """
        Publish up to 20 photos as an Instagram carousel post.
        Returns the post ID on success, None on failure.
        """
        caption_text = caption.formatted()

        if self.mode == "instagrapi":
            return self._publish_instagrapi(photos, caption_text)
        else:
            return self._publish_graph_api(photos, caption_text)

    def _publish_instagrapi(self, photos: List[Photo], caption_text: str) -> Optional[str]:
        if not self._client:
            raise RuntimeError("Not logged in. Call login() first.")

        paths = [str(p.path) for p in photos]
        if len(paths) == 1:
            media = self._client.photo_upload(paths[0], caption_text)
        else:
            media = self._client.album_upload(paths, caption_text)

        return str(media.id) if media else None

    def _publish_graph_api(self, photos: List[Photo], caption_text: str) -> Optional[str]:
        """
        Meta Graph API carousel publish flow:
        1. Upload each image as a container (media object).
        2. Create a carousel container referencing all child IDs.
        3. Publish the carousel container.

        Requires photos to be publicly accessible URLs or uploaded to a CDN.
        This stub outlines the flow; full implementation needs a CDN upload step.
        """
        import requests

        token = INSTAGRAM_ACCESS_TOKEN
        account_id = INSTAGRAM_BUSINESS_ACCOUNT_ID
        base_url = f"https://graph.facebook.com/v19.0/{account_id}"

        # Step 1: Create child media containers
        # NOTE: Graph API requires image URLs, not local file paths.
        # You need to upload images to a CDN first and pass their public URLs here.
        raise NotImplementedError(
            "Graph API publishing requires images hosted at public URLs. "
            "Implement a CDN upload step before calling this method."
        )
