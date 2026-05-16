import threading
from typing import List, Optional

from kivy.clock import Clock
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.screenmanager import Screen
from kivy.uix.scrollview import ScrollView
from kivy.uix.textinput import TextInput

from app.models.caption import Caption
from app.models.photo import Photo
from app.models.post_draft import PostDraft
from app.services.instagram_service import InstagramService
from app.storage.database import Database
from app.config.settings import INSTAGRAM_USERNAME, INSTAGRAM_PASSWORD


class PublishScreen(Screen):
    """
    Final confirmation screen before publishing to Instagram.
    Shows a preview of selected photos + chosen caption.
    Handles the publish flow with live status updates.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._photos: List[Photo] = []
        self._caption: Optional[Caption] = None
        self._draft_id: Optional[int] = None
        self._build_ui()

    def _build_ui(self):
        root = BoxLayout(orientation="vertical", padding=16, spacing=12)

        # Header
        self.title_label = Label(
            text="Ready to Publish",
            font_size="22sp",
            bold=True,
            size_hint=(1, 0.08),
        )

        # Photo count summary
        self.photo_count_label = Label(
            text="",
            font_size="14sp",
            color=(0.7, 0.7, 0.7, 1),
            size_hint=(1, 0.06),
        )

        # Caption preview
        caption_title = Label(
            text="Caption Preview",
            font_size="15sp",
            bold=True,
            size_hint=(1, 0.06),
            halign="left",
        )

        scroll = ScrollView(size_hint=(1, 0.35))
        self.caption_input = TextInput(
            text="",
            font_size="13sp",
            size_hint=(1, None),
            height=200,
            multiline=True,
            readonly=False,
        )
        scroll.add_widget(self.caption_input)

        # Credentials (pre-filled from .env)
        creds_box = BoxLayout(orientation="vertical", spacing=6, size_hint=(1, 0.18))
        creds_title = Label(text="Instagram Credentials", font_size="13sp", bold=True, size_hint=(1, 0.3))
        self.username_input = TextInput(
            text=INSTAGRAM_USERNAME,
            hint_text="Instagram username",
            multiline=False,
            font_size="13sp",
            size_hint=(1, 0.35),
        )
        self.password_input = TextInput(
            text=INSTAGRAM_PASSWORD if INSTAGRAM_PASSWORD else "",
            hint_text="Instagram password",
            password=True,
            multiline=False,
            font_size="13sp",
            size_hint=(1, 0.35),
        )
        creds_box.add_widget(creds_title)
        creds_box.add_widget(self.username_input)
        creds_box.add_widget(self.password_input)

        # Status label
        self.status_label = Label(
            text="",
            font_size="13sp",
            color=(0.6, 0.6, 0.6, 1),
            size_hint=(1, 0.07),
        )

        # Action buttons
        btn_row = BoxLayout(size_hint=(1, 0.11), spacing=12)
        back_btn = Button(
            text="← Back",
            background_color=(0.3, 0.3, 0.3, 1),
            font_size="14sp",
        )
        back_btn.bind(on_release=lambda _: setattr(self.manager, "current", "captions"))

        self.publish_btn = Button(
            text="Publish Now",
            background_color=(0.9, 0.3, 0.3, 1),
            font_size="15sp",
            bold=True,
        )
        self.publish_btn.bind(on_release=self._do_publish)

        btn_row.add_widget(back_btn)
        btn_row.add_widget(self.publish_btn)

        root.add_widget(self.title_label)
        root.add_widget(self.photo_count_label)
        root.add_widget(caption_title)
        root.add_widget(scroll)
        root.add_widget(creds_box)
        root.add_widget(self.status_label)
        root.add_widget(btn_row)
        self.add_widget(root)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load(self, photos: List[Photo], caption: Caption):
        self._photos = photos
        self._caption = caption
        self.photo_count_label.text = f"{len(photos)} photos selected for carousel"
        self.caption_input.text = caption.formatted()
        self.status_label.text = ""
        self.publish_btn.disabled = False

        # Save as draft first
        draft = PostDraft(photos=photos, caption=caption)
        with Database() as db:
            self._draft_id = db.save_draft(draft)

    # ------------------------------------------------------------------
    # Publish
    # ------------------------------------------------------------------

    def _do_publish(self, *_):
        self.publish_btn.disabled = True
        self.status_label.text = "Logging in to Instagram..."
        threading.Thread(target=self._publish_thread, daemon=True).start()

    def _publish_thread(self):
        username = self.username_input.text.strip()
        password = self.password_input.text.strip()

        if not username or not password:
            Clock.schedule_once(
                lambda _: self._set_status("Username and password are required.", error=True)
            )
            return

        try:
            service = InstagramService(mode="instagrapi")
            service.login(username, password)

            Clock.schedule_once(lambda _: self._set_status("Publishing carousel..."))

            # Use the edited caption text from the input field
            from copy import copy
            caption = copy(self._caption)
            caption.text = self.caption_input.text.strip()
            caption.hashtags = []  # hashtags already embedded in edited text

            post_id = service.publish_carousel(self._photos, caption)

            if post_id:
                with Database() as db:
                    if self._draft_id:
                        db.update_draft_status(self._draft_id, "published", post_id)
                Clock.schedule_once(
                    lambda _: self._set_status(f"Published! Post ID: {post_id}", success=True)
                )
                Clock.schedule_once(lambda _: self._go_home(), 2.5)
            else:
                Clock.schedule_once(
                    lambda _: self._set_status("Publish returned no post ID.", error=True)
                )

        except Exception as e:
            Clock.schedule_once(
                lambda _: self._set_status(f"Error: {e}", error=True)
            )

        Clock.schedule_once(lambda _: setattr(self.publish_btn, "disabled", False))

    def _go_home(self):
        self.manager.current = "home"

    def _set_status(self, text: str, error: bool = False, success: bool = False):
        self.status_label.text = text
        if error:
            self.status_label.color = (1, 0.3, 0.3, 1)
        elif success:
            self.status_label.color = (0.2, 0.9, 0.4, 1)
        else:
            self.status_label.color = (0.6, 0.6, 0.6, 1)
