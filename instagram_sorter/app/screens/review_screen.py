import tempfile
from pathlib import Path
from typing import Dict, List

from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.gridlayout import GridLayout
from kivy.uix.image import Image as KivyImage
from kivy.uix.label import Label
from kivy.uix.scrollview import ScrollView
from kivy.uix.screenmanager import Screen
from kivy.uix.togglebutton import ToggleButton

from app.models.photo import Photo

_HEIC_EXTENSIONS = {".heic", ".heif"}
_thumb_cache: dict[str, str] = {}  # original path → temp JPEG path


def _display_path(photo_path: Path) -> str:
    """Return a Kivy-renderable path. HEIC files are converted to temp JPEGs."""
    key = str(photo_path)
    if photo_path.suffix.lower() not in _HEIC_EXTENSIONS:
        return key
    if key in _thumb_cache:
        return _thumb_cache[key]
    try:
        from PIL import Image as PilImage
        try:
            from pillow_heif import register_heif_opener
            register_heif_opener()
        except ImportError:
            pass
        img = PilImage.open(photo_path).convert("RGB")
        img.thumbnail((300, 300))
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        img.save(tmp.name, "JPEG", quality=85)
        _thumb_cache[key] = tmp.name
        return tmp.name
    except Exception:
        return key  # fall back to original; Kivy will show blank


class PhotoThumb(BoxLayout):
    """A thumbnail tile that can be toggled selected/deselected."""

    def __init__(self, photo: Photo, **kwargs):
        super().__init__(orientation="vertical", size_hint=(None, None), size=(120, 140), **kwargs)
        self.photo = photo
        self._selected = photo.selected

        self.img = KivyImage(
            source=_display_path(photo.path),
            size_hint=(1, None),
            height=100,
            allow_stretch=True,
            keep_ratio=True,
        )

        self.toggle = ToggleButton(
            text="✓ Selected" if self._selected else "Add",
            state="down" if self._selected else "normal",
            size_hint=(1, None),
            height=30,
            font_size="11sp",
        )
        self.toggle.bind(on_release=self._on_toggle)

        self.add_widget(self.img)
        self.add_widget(self.toggle)

    def _on_toggle(self, btn):
        self._selected = btn.state == "down"
        self.photo.selected = self._selected
        btn.text = "✓ Selected" if self._selected else "Add"

    @property
    def is_selected(self):
        return self._selected


class ReviewScreen(Screen):
    """
    Shows the AI-selected photos in a grid.
    User can tap to toggle individual photos in/out of the post.
    Shows per-photo quality scores and location.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._thumbs: List[PhotoThumb] = []
        self._all_photos: List[Photo] = []
        self._cluster_names: Dict[int, str] = {}
        self._build_ui()

    def _build_ui(self):
        root = BoxLayout(orientation="vertical", padding=16, spacing=10)

        # Header
        header = BoxLayout(size_hint=(1, 0.08), spacing=12)
        self.title_label = Label(
            text="Review Selection",
            font_size="20sp",
            bold=True,
            halign="left",
        )
        self.count_label = Label(
            text="0 / 20 selected",
            font_size="14sp",
            color=(0.4, 0.8, 0.4, 1),
            halign="right",
        )
        header.add_widget(self.title_label)
        header.add_widget(self.count_label)

        # Location summary bar
        self.location_label = Label(
            text="",
            font_size="12sp",
            color=(0.6, 0.6, 0.6, 1),
            size_hint=(1, 0.05),
            halign="center",
        )

        # Scrollable photo grid
        scroll = ScrollView(size_hint=(1, 0.72))
        self.grid = GridLayout(cols=3, spacing=6, padding=6, size_hint_y=None)
        self.grid.bind(minimum_height=self.grid.setter("height"))
        scroll.add_widget(self.grid)

        # Action buttons
        btn_row = BoxLayout(size_hint=(1, 0.10), spacing=12)
        back_btn = Button(
            text="← Back",
            background_color=(0.3, 0.3, 0.3, 1),
            font_size="14sp",
        )
        back_btn.bind(on_release=lambda _: setattr(self.manager, "current", "home"))

        self.caption_btn = Button(
            text="Generate Captions →",
            background_color=(0.2, 0.6, 1, 1),
            font_size="14sp",
        )
        self.caption_btn.bind(on_release=self._go_to_captions)

        btn_row.add_widget(back_btn)
        btn_row.add_widget(self.caption_btn)

        root.add_widget(header)
        root.add_widget(self.location_label)
        root.add_widget(scroll)
        root.add_widget(btn_row)
        self.add_widget(root)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load(self, selected: List[Photo], all_photos: List[Photo], cluster_names: Dict[int, str]):
        self._all_photos = all_photos
        self._cluster_names = cluster_names
        self._thumbs = []
        self.grid.clear_widgets()

        for photo in all_photos:
            thumb = PhotoThumb(photo)
            self._thumbs.append(thumb)
            self.grid.add_widget(thumb)

        self._update_count()
        locations = [n for cid, n in cluster_names.items() if cid != -1]
        self.location_label.text = "Locations: " + " · ".join(locations[:6])

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _update_count(self):
        n = sum(1 for t in self._thumbs if t.is_selected)
        self.count_label.text = f"{n} / 20 selected"
        color = (1, 0.4, 0.4, 1) if n > 20 else (0.4, 0.8, 0.4, 1)
        self.count_label.color = color

    def _go_to_captions(self, *_):
        selected = [t.photo for t in self._thumbs if t.is_selected]
        if not selected:
            return
        if len(selected) > 20:
            self.count_label.text = f"Max 20! ({len(selected)} selected)"
            return

        caption_screen = self.manager.get_screen("captions")
        caption_screen.load(selected)
        self.manager.current = "captions"
