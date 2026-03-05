"""Lightweight HTTP server for the bundled OMAS dashboard.

Serves the Next.js static export from the ``omas/_dashboard/`` package data
directory.  For local development with an editable install the server falls
back to the original ``npm run dev`` workflow.

Key features:
  - SPA fallback: unmatched paths serve the directory's ``index.html``
  - ``/data/metrics.json`` is served from the runtime export directory
  - No Node.js runtime required
  - Silent log output (no per-request lines)
"""

from __future__ import annotations

import mimetypes
import os
import threading
import webbrowser
from functools import partial
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Optional

from rich.console import Console

console = Console()

# Ensure .js files are served with correct MIME type
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")


class DashboardHandler(SimpleHTTPRequestHandler):
    """HTTP handler with SPA fallback for the static dashboard."""

    # Set via functools.partial when constructing
    metrics_json_path: Optional[str] = None

    def do_GET(self) -> None:
        """Handle GET with SPA fallback logic."""
        # Serve runtime metrics.json from the export directory
        if self.path == "/data/metrics.json" or self.path == "/data/metrics.json/":
            if self.metrics_json_path and os.path.isfile(self.metrics_json_path):
                self.path = "/data/metrics.json"
                # Temporarily override directory to serve from metrics parent
                original_dir = self.directory
                self.directory = str(Path(self.metrics_json_path).parent.parent)
                super().do_GET()
                self.directory = original_dir
                return
            else:
                self.send_error(404, "metrics.json not found")
                return

        # Try to serve the file as-is first
        # Build the filesystem path
        path = self.translate_path(self.path)

        if os.path.isfile(path):
            super().do_GET()
            return

        # SPA fallback: if the path looks like a route (not a file),
        # try serving the directory's index.html or root index.html
        if os.path.isdir(path):
            index = os.path.join(path, "index.html")
            if os.path.isfile(index):
                super().do_GET()
                return

        # Final fallback: serve root index.html (SPA catch-all)
        self.path = "/index.html"
        super().do_GET()

    def log_message(self, format: str, *args: object) -> None:
        """Suppress per-request log output."""
        pass


def _get_bundled_dashboard_dir() -> Optional[Path]:
    """Return the path to the bundled dashboard, or None if not found."""
    bundled = Path(__file__).parent / "_dashboard"
    if bundled.is_dir() and (bundled / "index.html").is_file():
        return bundled
    return None


def _get_dev_dashboard_dir() -> Optional[Path]:
    """Return the path to the development dashboard/, or None."""
    # In an editable install, __file__ is src/omas/dashboard_server.py
    # and the dashboard dir is at the repo root: ../../dashboard
    dev_dir = Path(__file__).parent.parent.parent / "dashboard"
    if dev_dir.is_dir() and (dev_dir / "package.json").is_file():
        return dev_dir
    return None


def _find_metrics_json() -> Optional[str]:
    """Locate the most recent metrics.json export file."""
    # Check common locations
    candidates = [
        Path.home() / ".omas" / "data" / "metrics.json",
        Path.home() / ".oh-my-agentic-score" / "data" / "metrics.json",
    ]
    for p in candidates:
        if p.is_file():
            return str(p)
    return None


def serve_dashboard(port: int = 3002) -> None:
    """Start the dashboard HTTP server.

    Tries bundled static files first; falls back to ``npm run dev`` for
    development installs.
    """
    import subprocess

    bundled = _get_bundled_dashboard_dir()
    dev_dir = _get_dev_dashboard_dir()

    if bundled:
        # Production mode: serve static files via Python
        metrics_path = _find_metrics_json()
        url = f"http://localhost:{port}"

        handler = partial(DashboardHandler, directory=str(bundled))
        handler.metrics_json_path = metrics_path  # type: ignore[attr-defined]

        server = HTTPServer(("127.0.0.1", port), handler)

        console.print(f"[bold]Dashboard running at {url}[/bold]")
        if metrics_path:
            console.print(f"[dim]Metrics: {metrics_path}[/dim]")
        else:
            console.print("[dim]No metrics.json found. Run 'omas export' first.[/dim]")
        console.print("[dim]Press Ctrl+C to stop.[/dim]")

        # Open browser after short delay
        def _open():
            import time
            time.sleep(1)
            webbrowser.open(url)

        threading.Thread(target=_open, daemon=True).start()

        try:
            server.serve_forever()
        except KeyboardInterrupt:
            console.print("\n[dim]Dashboard stopped.[/dim]")
        finally:
            server.server_close()

    elif dev_dir:
        # Development mode: use npm run dev
        url = f"http://localhost:{port}"
        console.print(f"[bold]Starting Next.js dev dashboard at {url} ...[/bold]")

        def _open():
            import time
            time.sleep(3)
            webbrowser.open(url)

        threading.Thread(target=_open, daemon=True).start()

        try:
            subprocess.run(
                ["npm", "run", "dev", "--", "-p", str(port)],
                cwd=str(dev_dir),
            )
        except KeyboardInterrupt:
            console.print("\n[dim]Dashboard stopped.[/dim]")
        except FileNotFoundError:
            console.print("[red]npm not found. Install Node.js or use a packaged install.[/red]")

    else:
        console.print("[red]Dashboard not found.[/red]")
        console.print(
            "Install the full package (pip install oh-my-agentic-score) "
            "or run from the source repo."
        )
