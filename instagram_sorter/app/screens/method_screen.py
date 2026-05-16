from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.screenmanager import Screen


class MethodCard(BoxLayout):
    """A selectable card describing one pipeline method."""

    def __init__(self, title: str, tag: str, color: tuple,
                 bullets: list[str], on_choose, **kwargs):
        super().__init__(
            orientation="vertical",
            padding=20,
            spacing=10,
            size_hint=(1, None),
            height=280,
            **kwargs,
        )
        self._on_choose = on_choose
        self._method = tag

        title_label = Label(
            text=f"[b]{title}[/b]",
            markup=True,
            font_size="18sp",
            size_hint=(1, None),
            height=32,
            halign="center",
            color=color,
        )

        for bullet in bullets:
            bl = Label(
                text=f"• {bullet}",
                font_size="13sp",
                size_hint=(1, None),
                height=24,
                halign="left",
                color=(0.85, 0.85, 0.85, 1),
            )
            bl.bind(width=lambda w, v: w.setter("text_size")(w, (v, None)))
            self.add_widget(bl)

        choose_btn = Button(
            text=f"Use {title}",
            background_color=color,
            font_size="15sp",
            bold=True,
            size_hint=(1, None),
            height=44,
        )
        choose_btn.bind(on_release=lambda _: on_choose(tag))

        self.add_widget(title_label)
        for bullet in bullets:
            bl = Label(
                text=f"• {bullet}",
                font_size="13sp",
                size_hint=(1, None),
                height=24,
                halign="left",
                color=(0.85, 0.85, 0.85, 1),
            )
            self.add_widget(bl)
        self.add_widget(choose_btn)

    def _build(self, title, tag, color, bullets, on_choose):
        pass  # built inline above


class MethodScreen(Screen):
    """
    Lets the user choose between two photo curation approaches
    before the pipeline runs.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._folder: str = ""
        self._build_ui()

    def _build_ui(self):
        root = BoxLayout(orientation="vertical", padding=24, spacing=16)

        # Header
        root.add_widget(Label(
            text="[b]Choose Your Pipeline[/b]",
            markup=True,
            font_size="22sp",
            size_hint=(1, None),
            height=40,
            halign="center",
        ))

        self.folder_label = Label(
            text="",
            font_size="12sp",
            color=(0.5, 0.7, 1, 1),
            size_hint=(1, None),
            height=20,
            halign="center",
        )
        root.add_widget(self.folder_label)

        # ── Classic card ──────────────────────────────────────────────
        classic_bullets = [
            "Fast, deterministic, no API key needed",
            "OpenCV scores sharpness & lighting",
            "sklearn clusters photos by GPS location",
            "Greedy algorithm picks best across clusters",
            "GPT-4o / Claude writes captions at the end",
        ]

        classic_box = BoxLayout(
            orientation="vertical", padding=16, spacing=8,
            size_hint=(1, None), height=260,
        )
        classic_box.add_widget(Label(
            text="[b]Classic Pipeline[/b]",
            markup=True,
            font_size="17sp",
            size_hint=(1, None), height=30,
            color=(0.3, 0.8, 1, 1),
        ))
        for b in classic_bullets:
            classic_box.add_widget(Label(
                text=f"• {b}", font_size="12sp",
                size_hint=(1, None), height=22,
                color=(0.8, 0.8, 0.8, 1), halign="left",
            ))
        classic_btn = Button(
            text="Use Classic Pipeline",
            background_color=(0.2, 0.55, 0.85, 1),
            font_size="14sp", bold=True,
            size_hint=(1, None), height=44,
        )
        classic_btn.bind(on_release=lambda _: self._choose("classic"))
        classic_box.add_widget(classic_btn)
        root.add_widget(classic_box)

        # Divider
        root.add_widget(Label(
            text="── or ──",
            font_size="13sp",
            color=(0.4, 0.4, 0.4, 1),
            size_hint=(1, None), height=20,
            halign="center",
        ))

        # ── Agent card ────────────────────────────────────────────────
        agent_bullets = [
            "Claude looks at your actual photos via vision",
            "Reasons about quality, story, & diversity",
            "No hand-written scoring rules — Claude decides",
            "Writes captions naturally, not from a template",
            "Requires ANTHROPIC_API_KEY",
        ]

        agent_box = BoxLayout(
            orientation="vertical", padding=16, spacing=8,
            size_hint=(1, None), height=260,
        )
        agent_box.add_widget(Label(
            text="[b]AI Agent (Claude)[/b]",
            markup=True,
            font_size="17sp",
            size_hint=(1, None), height=30,
            color=(0.6, 0.35, 1, 1),
        ))
        for b in agent_bullets:
            agent_box.add_widget(Label(
                text=f"• {b}", font_size="12sp",
                size_hint=(1, None), height=22,
                color=(0.8, 0.8, 0.8, 1), halign="left",
            ))
        agent_btn = Button(
            text="Use AI Agent",
            background_color=(0.45, 0.2, 0.85, 1),
            font_size="14sp", bold=True,
            size_hint=(1, None), height=44,
        )
        agent_btn.bind(on_release=lambda _: self._choose("agent"))
        agent_box.add_widget(agent_btn)
        root.add_widget(agent_box)

        # Divider
        root.add_widget(Label(
            text="── or ──",
            font_size="13sp",
            color=(0.4, 0.4, 0.4, 1),
            size_hint=(1, None), height=20,
            halign="center",
        ))

        # ── OpenAI Agent card ─────────────────────────────────────────
        openai_bullets = [
            "GPT-4o looks at your actual photos via vision",
            "Same agentic reasoning as Claude option",
            "Requires OPENAI_API_KEY",
            "Good choice if you already have an OpenAI key",
        ]

        openai_box = BoxLayout(
            orientation="vertical", padding=16, spacing=8,
            size_hint=(1, None), height=240,
        )
        openai_box.add_widget(Label(
            text="[b]AI Agent (GPT-4o)[/b]",
            markup=True,
            font_size="17sp",
            size_hint=(1, None), height=30,
            color=(0.2, 0.8, 0.5, 1),
        ))
        for b in openai_bullets:
            openai_box.add_widget(Label(
                text=f"• {b}", font_size="12sp",
                size_hint=(1, None), height=22,
                color=(0.8, 0.8, 0.8, 1), halign="left",
            ))
        openai_btn = Button(
            text="Use GPT-4o Agent",
            background_color=(0.1, 0.6, 0.35, 1),
            font_size="14sp", bold=True,
            size_hint=(1, None), height=44,
        )
        openai_btn.bind(on_release=lambda _: self._choose("openai_agent"))
        openai_box.add_widget(openai_btn)
        root.add_widget(openai_box)

        # Back button
        back_btn = Button(
            text="← Back",
            background_color=(0.25, 0.25, 0.25, 1),
            font_size="13sp",
            size_hint=(1, None), height=38,
        )
        back_btn.bind(on_release=lambda _: setattr(self.manager, "current", "home"))
        root.add_widget(back_btn)

        self.add_widget(root)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def set_folder(self, folder: str, date_from: str = None, date_to: str = None, vibe: str = None):
        self._folder = folder
        self._date_from = date_from
        self._date_to = date_to
        self._vibe = vibe
        self.folder_label.text = f"Folder: {folder}"

    # ------------------------------------------------------------------

    def _choose(self, method: str):
        processing = self.manager.get_screen("processing")
        processing.start(
            self._folder,
            method=method,
            date_from=self._date_from,
            date_to=self._date_to,
            vibe=self._vibe,
        )
        self.manager.current = "processing"
