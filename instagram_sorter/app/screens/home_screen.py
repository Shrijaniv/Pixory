from kivy.uix.screenmanager import Screen
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.textinput import TextInput
from kivy.uix.filechooser import FileChooserListView
from kivy.uix.popup import Popup


class HomeScreen(Screen):
    """
    Entry screen: lets the user pick a local photo folder and start the pipeline.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._build_ui()

    def _build_ui(self):
        layout = BoxLayout(orientation="vertical", padding=24, spacing=16)

        title = Label(
            text="PhotoSort",
            font_size="32sp",
            bold=True,
            size_hint=(1, 0.15),
            halign="center",
        )

        subtitle = Label(
            text="Sort • Select • Post",
            font_size="16sp",
            size_hint=(1, 0.08),
            halign="center",
            color=(0.6, 0.6, 0.6, 1),
        )

        self.folder_label = Label(
            text="No folder selected",
            font_size="14sp",
            size_hint=(1, 0.08),
            halign="center",
            color=(0.4, 0.7, 1, 1),
        )

        # Path text input for pasting a folder path directly
        path_row = BoxLayout(orientation="horizontal", size_hint=(1, 0.08), spacing=8)
        self.path_input = TextInput(
            hint_text="Paste folder path here…",
            multiline=False,
            font_size="13sp",
            size_hint=(0.78, 1),
        )
        self.path_input.bind(on_text_validate=self._on_path_entered)
        use_path_btn = Button(
            text="Use Path",
            size_hint=(0.22, 1),
            background_color=(0.2, 0.6, 1, 1),
            font_size="13sp",
        )
        use_path_btn.bind(on_release=self._on_path_entered)
        path_row.add_widget(self.path_input)
        path_row.add_widget(use_path_btn)

        pick_btn = Button(
            text="Browse for Folder",
            size_hint=(1, 0.08),
            background_color=(0.15, 0.45, 0.75, 1),
            font_size="14sp",
        )
        pick_btn.bind(on_release=self._open_file_chooser)

        # Date range row
        date_row = BoxLayout(orientation="horizontal", size_hint=(1, 0.08), spacing=8)
        date_row.add_widget(Label(
            text="Date range:",
            font_size="13sp",
            size_hint=(0.22, 1),
            halign="right",
            color=(0.7, 0.7, 0.7, 1),
        ))
        self.date_from_input = TextInput(
            hint_text="From  YYYY-MM-DD",
            multiline=False,
            font_size="13sp",
            size_hint=(0.39, 1),
        )
        self.date_to_input = TextInput(
            hint_text="To  YYYY-MM-DD",
            multiline=False,
            font_size="13sp",
            size_hint=(0.39, 1),
        )
        date_row.add_widget(self.date_from_input)
        date_row.add_widget(self.date_to_input)

        # Vibe / theme row
        vibe_row = BoxLayout(orientation="horizontal", size_hint=(1, 0.08), spacing=8)
        vibe_row.add_widget(Label(
            text="Vibe / theme:",
            font_size="13sp",
            size_hint=(0.22, 1),
            halign="right",
            color=(0.7, 0.7, 0.7, 1),
        ))
        self.vibe_input = TextInput(
            hint_text="e.g. beach trip, cozy autumn, travel adventure…",
            multiline=False,
            font_size="13sp",
            size_hint=(0.78, 1),
        )
        vibe_row.add_widget(self.vibe_input)

        self.start_btn = Button(
            text="Choose Pipeline & Start →",
            size_hint=(1, 0.10),
            background_color=(0.1, 0.8, 0.4, 1),
            font_size="16sp",
            disabled=True,
        )
        self.start_btn.bind(on_release=self._start_pipeline)

        history_btn = Button(
            text="View Draft History",
            size_hint=(1, 0.08),
            background_color=(0.3, 0.3, 0.3, 1),
            font_size="14sp",
        )
        history_btn.bind(on_release=self._go_to_history)

        layout.add_widget(title)
        layout.add_widget(subtitle)
        layout.add_widget(self.folder_label)
        layout.add_widget(path_row)
        layout.add_widget(pick_btn)
        layout.add_widget(date_row)
        layout.add_widget(vibe_row)
        layout.add_widget(self.start_btn)
        layout.add_widget(history_btn)

        self.add_widget(layout)

    # ------------------------------------------------------------------
    # Handlers
    # ------------------------------------------------------------------

    def _on_path_entered(self, *_):
        import os
        path = self.path_input.text.strip()
        if path and os.path.isdir(path):
            self._selected_folder = path
            self.folder_label.text = f"Folder: {path}"
            self.start_btn.disabled = False
        else:
            self.folder_label.text = "Invalid path — folder not found"
            self.folder_label.color = (1, 0.4, 0.4, 1)

    def _open_file_chooser(self, *_):
        content = BoxLayout(orientation="vertical", spacing=8)
        chooser = FileChooserListView(dirselect=True, path="/")
        confirm_btn = Button(text="Select Folder", size_hint=(1, 0.1))

        def on_confirm(*_):
            if chooser.selection:
                self._selected_folder = chooser.selection[0]
                self.folder_label.text = f"Folder: {self._selected_folder}"
                self.folder_label.color = (0.4, 0.7, 1, 1)
                self.start_btn.disabled = False
            popup.dismiss()

        confirm_btn.bind(on_release=on_confirm)
        content.add_widget(chooser)
        content.add_widget(confirm_btn)

        popup = Popup(
            title="Select Photo Folder",
            content=content,
            size_hint=(0.95, 0.85),
        )
        popup.open()

    def _start_pipeline(self, *_):
        folder = getattr(self, "_selected_folder", None)
        if not folder:
            return
        date_from = self.date_from_input.text.strip() or None
        date_to = self.date_to_input.text.strip() or None
        vibe = self.vibe_input.text.strip() or None
        method_screen = self.manager.get_screen("method")
        method_screen.set_folder(folder, date_from=date_from, date_to=date_to, vibe=vibe)
        self.manager.current = "method"

    def _go_to_history(self, *_):
        self.manager.current = "history"
