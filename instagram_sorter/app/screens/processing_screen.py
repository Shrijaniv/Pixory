import threading

from kivy.clock import Clock
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.label import Label
from kivy.uix.progressbar import ProgressBar
from kivy.uix.screenmanager import Screen

from app.core.gallery_scanner import scan_gallery
from app.core.deduplicator import remove_duplicates
from app.core.location_clusterer import cluster_photos
from app.core.photo_scorer import score_photos
from app.core.photo_selector import select_photos
from app.storage.database import Database

CLASSIC_STEPS = [
    "Scanning gallery...",
    "Removing duplicates...",
    "Clustering by location...",
    "Scoring photo quality...",
    "Selecting best photos...",
    "Done!",
]


class ProcessingScreen(Screen):
    """
    Runs the chosen pipeline in a background thread.
    Supports two modes:
      - "classic"  : deterministic OpenCV/sklearn pipeline
      - "agent"    : Claude tool-use agentic pipeline
    Updates progress on the main thread via Clock.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._build_ui()

    def _build_ui(self):
        self.layout = BoxLayout(orientation="vertical", padding=32, spacing=20)

        self.mode_label = Label(
            text="",
            font_size="13sp",
            halign="center",
            color=(0.5, 0.5, 0.5, 1),
            size_hint=(1, 0.08),
        )

        self.step_label = Label(
            text="Starting...",
            font_size="18sp",
            halign="center",
            size_hint=(1, 0.12),
        )

        self.progress = ProgressBar(
            max=len(CLASSIC_STEPS), value=0, size_hint=(1, 0.06)
        )

        self.detail_label = Label(
            text="",
            font_size="13sp",
            halign="center",
            color=(0.6, 0.6, 0.6, 1),
            size_hint=(1, 0.60),
            valign="top",
        )
        self.detail_label.bind(
            width=lambda w, v: w.setter("text_size")(w, (v, None))
        )

        self.layout.add_widget(self.mode_label)
        self.layout.add_widget(self.step_label)
        self.layout.add_widget(self.progress)
        self.layout.add_widget(self.detail_label)
        self.add_widget(self.layout)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self, folder: str, method: str = "classic",
              date_from: str = None, date_to: str = None, vibe: str = None):
        self._method = method
        self._date_from = date_from
        self._date_to = date_to
        self._vibe = vibe
        self.step_label.text = "Starting..."
        self.progress.value = 0
        self.detail_label.text = ""

        if method == "agent":
            self.mode_label.text = "Mode: AI Agent (Claude)"
            self.progress.max = 1
            threading.Thread(
                target=self._run_agent_pipeline, args=(folder,), daemon=True
            ).start()
        elif method == "openai_agent":
            self.mode_label.text = "Mode: AI Agent (GPT-4o)"
            self.progress.max = 1
            threading.Thread(
                target=self._run_agent_pipeline, args=(folder,), daemon=True
            ).start()
        else:
            self.mode_label.text = "Mode: Classic Pipeline"
            self.progress.max = len(CLASSIC_STEPS)
            threading.Thread(
                target=self._run_classic_pipeline, args=(folder,), daemon=True
            ).start()

    # ------------------------------------------------------------------
    # Classic pipeline (runs on background thread)
    # ------------------------------------------------------------------

    def _run_classic_pipeline(self, folder: str):
        from datetime import datetime
        db = Database()

        self._set_step(0, "Scanning gallery...")
        photos = scan_gallery(folder)
        self._set_detail(f"Found {len(photos)} photos")

        # Filter by date range if specified
        date_from = self._date_from
        date_to = self._date_to
        if date_from or date_to:
            try:
                dt_from = datetime.strptime(date_from, "%Y-%m-%d") if date_from else None
                dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59) if date_to else None
                before = len(photos)
                photos = [
                    p for p in photos
                    if (dt_from is None or (p.date and p.date >= dt_from))
                    and (dt_to is None or (p.date and p.date <= dt_to))
                ]
                self._set_detail(f"Found {len(photos)} photos in range (filtered from {before})")
            except ValueError:
                self._set_detail(f"Invalid date format — using all {len(photos)} photos")

        self._set_step(1, "Removing duplicates...")
        photos = remove_duplicates(photos)
        self._set_detail(f"{len(photos)} unique photos")

        self._set_step(2, "Clustering by location...")
        photos, cluster_names = cluster_photos(photos)
        summary = "  |  ".join(
            f"{name} ({sum(1 for p in photos if p.cluster_id == cid)})"
            for cid, name in list(cluster_names.items())[:4]
        )
        self._set_detail(summary)

        self._set_step(3, "Scoring photo quality...")
        photos = score_photos(photos)
        self._set_detail(f"Scored {len(photos)} photos")

        self._set_step(4, "Selecting best photos (max 20)...")
        selected = select_photos(photos)
        self._set_detail(f"Selected {len(selected)} photos")

        db.upsert_photos(photos)
        db.close()

        self._set_step(5, "Done!")
        Clock.schedule_once(
            lambda _: self._go_to_review(selected, photos, cluster_names), 0.8
        )

    # ------------------------------------------------------------------
    # Agent pipeline (runs on background thread)
    # ------------------------------------------------------------------

    def _run_agent_pipeline(self, folder: str):
        if self._method == "openai_agent":
            self._run_openai_agent(folder)
            return

        from app.core.agent_pipeline import run_agent_pipeline
        from app.services.claude_service import ClaudeService
        from app.config.settings import ANTHROPIC_API_KEY

        if not ANTHROPIC_API_KEY:
            Clock.schedule_once(
                lambda _: self._set_error(
                    "ANTHROPIC_API_KEY is not set in your .env file.\n"
                    "Add it and restart the app."
                )
            )
            return

        self._set_step(0, "Claude is analyzing your photos...")

        def on_thinking(text: str):
            display = text[:400] + "..." if len(text) > 400 else text
            self._set_detail(display)

        try:
            service = ClaudeService(api_key=ANTHROPIC_API_KEY)
            result = run_agent_pipeline(
                folder=folder,
                claude_service=service,
                on_thinking=on_thinking,
                on_progress=lambda msg: self._set_step(0, msg),
                date_from=self._date_from,
                date_to=self._date_to,
                vibe=self._vibe,
            )
        except Exception as e:
            Clock.schedule_once(lambda _, err=e: self._set_error(str(err)))
            return

        self._finish_agent(result, "Claude")

    def _run_openai_agent(self, folder: str):
        from app.core.openai_agent_pipeline import run_openai_agent_pipeline
        from app.services.openai_service import OpenAIService
        from app.config.settings import OPENAI_API_KEY

        if not OPENAI_API_KEY:
            Clock.schedule_once(
                lambda _: self._set_error(
                    "OPENAI_API_KEY is not set in your .env file.\n"
                    "Add it and restart the app."
                )
            )
            return

        self._set_step(0, "GPT-4o is analyzing your photos...")

        def on_thinking(text: str):
            display = text[:400] + "..." if len(text) > 400 else text
            self._set_detail(display)

        try:
            service = OpenAIService(api_key=OPENAI_API_KEY)
            result = run_openai_agent_pipeline(
                folder=folder,
                openai_service=service,
                on_thinking=on_thinking,
                on_progress=lambda msg: self._set_step(0, msg),
                date_from=self._date_from,
                date_to=self._date_to,
                vibe=self._vibe,
            )
        except Exception as e:
            Clock.schedule_once(lambda _, err=e: self._set_error(str(err)))
            return

        self._finish_agent(result, "GPT-4o")

    def _finish_agent(self, result, label: str):
        self._set_step(1, "Done!")
        self._set_detail(
            result.curation_notes or f"{label} selected {len(result.selected)} photos."
        )
        cluster_names = {
            p.cluster_id: p.place_name
            for p in result.selected
            if p.cluster_id is not None and p.place_name
        }
        Clock.schedule_once(
            lambda _: self._go_to_review_with_captions(
                result.selected, result.selected, cluster_names, result.captions
            ),
            1.0,
        )

    # ------------------------------------------------------------------
    # Navigation helpers
    # ------------------------------------------------------------------

    def _go_to_review(self, selected, all_photos, cluster_names):
        review = self.manager.get_screen("review")
        review.load(selected, all_photos, cluster_names)
        self.manager.current = "review"

    def _go_to_review_with_captions(self, selected, all_photos, cluster_names, captions):
        """
        For the agent mode: skip straight to the caption screen with
        pre-generated captions, but still allow photo review first.
        """
        review = self.manager.get_screen("review")
        review.load(selected, all_photos, cluster_names)
        # Pre-load captions so the caption screen doesn't regenerate them
        caption_screen = self.manager.get_screen("captions")
        caption_screen.preload(captions)
        self.manager.current = "review"

    def _set_error(self, message: str):
        self.step_label.text = "Error"
        self.step_label.color = (1, 0.3, 0.3, 1)
        self.detail_label.text = message

    # ------------------------------------------------------------------
    # Thread-safe UI helpers
    # ------------------------------------------------------------------

    def _set_step(self, step: int, text: str):
        def _update(_):
            self.step_label.text = text
            if self._method == "classic":
                self.progress.value = step

        Clock.schedule_once(_update)

    def _set_detail(self, text: str):
        Clock.schedule_once(lambda _: setattr(self.detail_label, "text", text))
