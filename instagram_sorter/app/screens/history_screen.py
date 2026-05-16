import json
from typing import List

from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.screenmanager import Screen

from app.storage.database import Database

STATUS_COLORS = {
    "draft":      (0.6, 0.6, 0.6, 1),
    "approved":   (0.4, 0.7, 1, 1),
    "publishing": (1, 0.8, 0.2, 1),
    "published":  (0.2, 0.9, 0.4, 1),
    "failed":     (1, 0.3, 0.3, 1),
}


class DraftRow(BoxLayout):
    def __init__(self, draft: dict, **kwargs):
        super().__init__(
            orientation="horizontal",
            size_hint=(1, None),
            height=70,
            padding=[8, 4],
            spacing=8,
            **kwargs,
        )
        paths = json.loads(draft.get("photo_paths_json", "[]"))
        created = draft.get("created_at", "")[:16]
        status = draft.get("status", "draft")
        mood = draft.get("caption_mood") or "—"
        n_photos = len(paths)

        info = BoxLayout(orientation="vertical", size_hint=(0.75, 1))
        info.add_widget(Label(
            text=f"[b]{n_photos} photos[/b]  ·  {mood}",
            markup=True,
            font_size="13sp",
            halign="left",
            size_hint=(1, 0.5),
        ))
        info.add_widget(Label(
            text=created,
            font_size="11sp",
            color=(0.5, 0.5, 0.5, 1),
            halign="left",
            size_hint=(1, 0.5),
        ))

        status_label = Label(
            text=status.upper(),
            font_size="12sp",
            bold=True,
            color=STATUS_COLORS.get(status, (0.6, 0.6, 0.6, 1)),
            size_hint=(0.25, 1),
            halign="right",
        )

        self.add_widget(info)
        self.add_widget(status_label)


class HistoryScreen(Screen):
    """Displays a scrollable list of all saved post drafts."""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._build_ui()

    def _build_ui(self):
        root = BoxLayout(orientation="vertical", padding=16, spacing=10)

        header = BoxLayout(size_hint=(1, 0.08))
        header.add_widget(Label(text="Draft History", font_size="22sp", bold=True))

        back_btn = Button(
            text="← Home",
            size_hint=(0.3, 1),
            background_color=(0.3, 0.3, 0.3, 1),
            font_size="14sp",
        )
        back_btn.bind(on_release=lambda _: setattr(self.manager, "current", "home"))
        header.add_widget(back_btn)

        self.empty_label = Label(
            text="No drafts yet.",
            font_size="15sp",
            color=(0.5, 0.5, 0.5, 1),
            size_hint=(1, 0.1),
        )

        scroll = ScrollView(size_hint=(1, 0.82))
        self.list_layout = BoxLayout(
            orientation="vertical",
            spacing=6,
            size_hint_y=None,
        )
        self.list_layout.bind(minimum_height=self.list_layout.setter("height"))
        scroll.add_widget(self.list_layout)

        root.add_widget(header)
        root.add_widget(self.empty_label)
        root.add_widget(scroll)
        self.add_widget(root)

    def on_pre_enter(self, *_):
        """Reload drafts every time the screen becomes visible."""
        self._load_drafts()

    def _load_drafts(self):
        self.list_layout.clear_widgets()
        with Database() as db:
            drafts = db.get_all_drafts()

        if not drafts:
            self.empty_label.opacity = 1
        else:
            self.empty_label.opacity = 0
            for draft in drafts:
                self.list_layout.add_widget(DraftRow(draft))
