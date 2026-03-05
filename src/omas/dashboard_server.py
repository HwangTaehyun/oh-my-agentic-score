"""Lightweight HTTP server for the bundled OMAS dashboard.

Serves the Next.js static export from the ``omas/_dashboard/`` package data
directory.  For local development with an editable install the server falls
back to the original ``npm run dev`` workflow.

Key features:
  - SPA fallback: unmatched paths serve the directory's ``index.html``
  - ``/data/metrics.json`` is served from ``~/.omas/data/metrics.json``
  - No Node.js runtime required
  - Silent log output (no per-request lines)
"""

from __future__ import annotations

import mimetypes
import os
import threading
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Optional

from rich.console import Console

console = Console()

# Ensure .js files are served with correct MIME type
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")


def _make_handler_class(
    dashboard_dir: str, metrics_json_path: Optional[str]
) -> type:
    """Create a handler class with the given dashboard dir and metrics path."""

    class DashboardHandler(SimpleHTTPRequestHandler):
        """HTTP handler with SPA fallback for the static dashboard."""

        def __init__(self, *args, **kwargs):
            kwargs.setdefault("directory", dashboard_dir)
            super().__init__(*args, **kwargs)

        def do_GET(self) -> None:
            """Handle GET with SPA fallback logic."""
            # Serve runtime metrics.json from ~/.omas/data/
            if self.path in ("/data/metrics.json", "/data/metrics.json/"):
                if metrics_json_path and os.path.isfile(metrics_json_path):
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Access-Control-Allow-Origin", "*")
                    data = Path(metrics_json_path).read_bytes()
                    self.send_header("Content-Length", str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    return
                else:
                    self.send_error(404, "metrics.json not found. Run: omas scan && omas export")
                    return

            # Try to serve the file as-is first
            path = self.translate_path(self.path)

            if os.path.isfile(path):
                super().do_GET()
                return

            # SPA fallback: if the path is a directory with index.html, serve it
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

    return DashboardHandler


def _get_bundled_dashboard_dir() -> Optional[Path]:
    """Return the path to the bundled dashboard, or None if not found."""
    bundled = Path(__file__).parent / "_dashboard"
    if bundled.is_dir() and (bundled / "index.html").is_file():
        return bundled
    return None


def _get_dev_dashboard_dir() -> Optional[Path]:
    """Return the path to the development dashboard/, or None."""
    dev_dir = Path(__file__).parent.parent.parent / "dashboard"
    if dev_dir.is_dir() and (dev_dir / "package.json").is_file():
        return dev_dir
    return None


def _find_metrics_json() -> Optional[str]:
    """Locate the metrics.json export file."""
    from omas.config import OMAS_DIR
    p = OMAS_DIR / "data" / "metrics.json"
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

    # Use static export (dashboard/out/) from dev repo if available
    static_dir = bundled
    if not static_dir and dev_dir:
        out_dir = dev_dir / "out"
        if out_dir.is_dir() and (out_dir / "index.html").is_file():
            static_dir = out_dir

    if static_dir:
        # Serve static files via Python HTTP server
        metrics_path = _find_metrics_json()
        url = f"http://localhost:{port}"

        handler_class = _make_handler_class(str(static_dir), metrics_path)
        server = HTTPServer(("127.0.0.1", port), handler_class)

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
