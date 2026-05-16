import threading
from typing import List, Optional

from kivy.clock import Clock
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.screenmanager import Screen
from kivy.uix.togglebutton import ToggleButton

from app.models.caption import Caption
from app.models.photo import Photo
from app.models.post_draft import PostDraft
from app.core.caption_generator import generate_captions
from app.services.openai_service import OpenAIService
from app.storage.database import Database
from app.config.settings import OPENAI_API_KEY

MOOD_COLORS = {
    "wanderlust": (0.2, 0.5, 0.9, 1),
    "minimal":    (0.5, 0.5, 0.5, 1),
    "story":      (0.8, 0.5, 0.2, 1),
    "playful":    (0.2, 0.8, 0.5, 1),
    "auto":       (0.6, 0.3, 0.9, 1),
}


class CaptionCard(BoxLayout):
    """A card displaying one caption option with a select toggle."""

    def __init__(self, caption: Caption, on_select, **kwargs):
        super().__init__(orientation="vertical", padding=12, spacing=6,
                         size_hint=(1, None), **kwargs)
        self.caption = caption
        self._on_select = on_select
        self.height = 160

        mood_color = MOOD_COLORS.get(caption.mood, (0.5, 0.5, 0.5, 1))

        mood_label = Label(
            text=f"[b]{caption.mood.upper()}[/b]",
            markup=True,
            font_size="13sp",
            color=mood_color,
            size_hint=(1, None),
            height=22,
            halign="left",
        )

        text_label = Label(
            text=caption.text,
            font_size="13sp",
            size_hint=(1, None),
            height=80,
            halign="left",
            valign="top",
            text_size=(None, None),
        )
        text_label.bind(width=lambda *x: text_label.setter("text_size")(text_label, (text_label.width, None)))

        hashtags_label = Label(
            text=" ".join(f"#{h}" for h in caption.hashtags),
            font_size="11sp",
            color=(0.4, 0.7, 1, 1),
            size_hint=(1, None),
            height=20,
            halign="left",
        )

        select_btn = ToggleButton(
            text="Use this caption",
            size_hint=(1, None),
            height=36,
            font_size="13sp",
            group="captions",
        )
        select_btn.bind(on_release=lambda btn: self._on_select(self.caption, btn))

        self.add_widget(mood_label)
        self.add_widget(text_label)
        self.add_widget(hashtags_label)
        self.add_widget(select_btn)


class CaptionScreen(Screen):
    """
    Displays AI-generated captions for selection.
    Allows the user to pick one, then proceed to publish or save as draft.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._photos: List[Photo] = []
        self._captions: List[Caption] = []
        self._chosen_caption: Optional[Caption] = None
        self._build_ui()

    def _build_ui(self):
        root = BoxLayout(orientation="vertical", padding=16, spacing=10)

        # Header
        header = BoxLayout(size_hint=(1, 0.08), spacing=12)
        self.title_label = Label(
            text="Choose a Caption",
            font_size="20sp",
            bold=True,
        )
        self.status_label = Label(
            text="Generating...",
            font_size="13sp",
            color=(0.6, 0.6, 0.6, 1),
            halign="right",
        )
        header.add_widget(self.title_label)
        header.add_widget(self.status_label)

        # Caption cards in a scroll view
        scroll = ScrollView(size_hint=(1, 0.75))
        self.cards_layout = BoxLayout(
            orientation="vertical",
            spacing=10,
            padding=[0, 8],
            size_hint_y=None,
        )
        self.cards_layout.bind(minimum_height=self.cards_layout.setter("height"))
        scroll.add_widget(self.cards_layout)

        # Action buttons
        btn_row = BoxLayout(size_hint=(1, 0.12), spacing=12)

        back_btn = Button(
            text="← Back",
            background_color=(0.3, 0.3, 0.3, 1),
            font_size="14sp",
        )
        back_btn.bind(on_release=lambda _: setattr(self.manager, "current", "review"))

        self.save_btn = Button(
            text="Save Draft",
            background_color=(0.4, 0.4, 0.8, 1),
            font_size="14sp",
            disabled=True,
        )
        self.save_btn.bind(on_release=self._save_draft)

        self.publish_btn = Button(
            text="Publish to Instagram",
            background_color=(0.1, 0.8, 0.4, 1),
            font_size="14sp",
            disabled=True,
        )
        self.publish_btn.bind(on_release=self._go_to_publish)

        btn_row.add_widget(back_btn)
        btn_row.add_widget(self.save_btn)
        btn_row.add_widget(self.publish_btn)

        root.add_widget(header)
        root.add_widget(scroll)
        root.add_widget(btn_row)
        self.add_widget(root)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load(self, photos: List[Photo]):
        self._photos = photos
        self._chosen_caption = None
        self._preloaded_captions = None
        self.save_btn.disabled = True
        self.publish_btn.disabled = True
        self.cards_layout.clear_widgets()
        self.status_label.text = "Generating captions..."

        threading.Thread(target=self._generate, daemon=True).start()

    def preload(self, captions: List):
        """
        Called by the agent pipeline to pre-supply captions so the
        caption screen skips regeneration and shows them immediately.
        """
        self._preloaded_captions = captions

    # ------------------------------------------------------------------
    # Background generation
    # ------------------------------------------------------------------

    def _generate(self):
        # Agent pipeline pre-supplied captions — show them immediately
        if getattr(self, "_preloaded_captions", None):
            Clock.schedule_once(lambda _: self._show_captions(self._preloaded_captions))
            return

        try:
            openai = OpenAIService(api_key=OPENAI_API_KEY)
            captions = generate_captions(self._photos, openai)
        except Exception as e:
            captions = []
            Clock.schedule_once(
                lambda _: setattr(self.status_label, "text", f"Error: {e}")
            )

        Clock.schedule_once(lambda _: self._show_captions(captions))

    def _show_captions(self, captions: List[Caption]):
        self._captions = captions
        self.cards_layout.clear_widgets()
        self.status_label.text = f"{len(captions)} options ready"

        for caption in captions:
            card = CaptionCard(caption, on_select=self._on_caption_selected)
            self.cards_layout.add_widget(card)

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    def _on_caption_selected(self, caption: Caption, btn):
        if btn.state == "down":
            self._chosen_caption = caption
            self.save_btn.disabled = False
            self.publish_btn.disabled = False
        else:
            self._chosen_caption = None
            self.save_btn.disabled = True
            self.publish_btn.disabled = True

    def _save_draft(self, *_):
        if not self._chosen_caption:
            return
        draft = PostDraft(photos=self._photos, caption=self._chosen_caption)
        with Database() as db:
            draft_id = db.save_draft(draft)
        self.status_label.text = f"Draft #{draft_id} saved!"

    def _go_to_publish(self, *_):
        if not self._chosen_caption:
            return
        publish_screen = self.manager.get_screen("publish")
        publish_screen.load(self._photos, self._chosen_caption)
        self.manager.current = "publish"
