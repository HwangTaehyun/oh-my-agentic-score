"""Textual TUI screen for OAuth Device Flow authentication."""

from __future__ import annotations

from textual.app import App, ComposeResult
from textual.containers import Center, Vertical
from textual.widgets import Button, Header, Footer, Label, RadioButton, RadioSet, Static


class AuthScreen(App):
    """OAuth Device Flow authentication TUI."""

    CSS = """
    Screen {
        align: center middle;
    }
    #auth-container {
        width: 60;
        height: auto;
        border: solid $accent;
        padding: 2 4;
    }
    #provider-group {
        margin: 1 0;
    }
    #device-code {
        text-align: center;
        text-style: bold;
        color: $success;
        margin: 1 0;
    }
    #status-label {
        text-align: center;
        margin: 1 0;
    }
    .button-row {
        layout: horizontal;
        align: center middle;
        margin-top: 1;
    }
    """

    TITLE = "OMAS Authentication"

    def compose(self) -> ComposeResult:
        yield Header()
        with Center():
            with Vertical(id="auth-container"):
                yield Label("Select authentication provider:", id="provider-label")
                with RadioSet(id="provider-group"):
                    yield RadioButton("GitHub", value=True, id="github")
                    yield RadioButton("Google", id="google")
                yield Static("", id="url-display")
                yield Static("", id="device-code")
                yield Label("Click 'Start' to begin authentication", id="status-label")
                with Center(classes="button-row"):
                    yield Button("Start", id="start-btn", variant="primary")
                    yield Button("Cancel", id="cancel-btn", variant="error")
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "cancel-btn":
            self.exit()
        elif event.button.id == "start-btn":
            self.query_one("#status-label", Label).update("Starting authentication...")
            # Provider selection would trigger device flow here
            self.exit(result="started")


def run_auth_tui() -> str | None:
    """Run the auth TUI and return the result."""
    app = AuthScreen()
    return app.run()
