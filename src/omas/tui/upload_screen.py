"""Textual TUI screen for upload progress display."""

from __future__ import annotations

from textual.app import App, ComposeResult
from textual.containers import Center, Vertical
from textual.widgets import Button, Header, Footer, Label, ProgressBar, Static


class UploadScreen(App):
    """Upload progress TUI."""

    CSS = """
    Screen {
        align: center middle;
    }
    #upload-container {
        width: 60;
        height: auto;
        border: solid $accent;
        padding: 2 4;
    }
    #stats-display {
        margin: 1 0;
    }
    .button-row {
        layout: horizontal;
        align: center middle;
        margin-top: 1;
    }
    """

    TITLE = "OMAS Cloud Upload"

    def __init__(self, qualified: int = 0, excluded: int = 0, **kwargs):
        super().__init__(**kwargs)
        self.qualified_count = qualified
        self.excluded_count = excluded

    def compose(self) -> ComposeResult:
        yield Header()
        with Center():
            with Vertical(id="upload-container"):
                yield Label(f"Qualified sessions: {self.qualified_count}", id="qualified-label")
                yield Label(f"Excluded sessions: {self.excluded_count}", id="excluded-label")
                yield ProgressBar(total=100, id="upload-progress")
                yield Static("", id="stats-display")
                yield Label("Ready to upload", id="status-label")
                with Center(classes="button-row"):
                    yield Button("Upload", id="upload-btn", variant="primary")
                    yield Button("Dry Run", id="dry-run-btn", variant="warning")
                    yield Button("Cancel", id="cancel-btn", variant="error")
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel-btn":
            self.exit()
        elif event.button.id == "upload-btn":
            self.query_one("#status-label", Label).update("Uploading...")
            self.exit(result="upload")
        elif event.button.id == "dry-run-btn":
            self.exit(result="dry-run")
