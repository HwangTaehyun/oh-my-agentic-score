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
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from typing import Optional

from rich.console import Console

console = Console()

# Ensure .js files are served with correct MIME type
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")

# Maximum number of ports to try before giving up
_MAX_PORT_ATTEMPTS = 20


def _find_available_port(start_port: int) -> int:
    """Find an available port starting from *start_port*.

    Tries up to ``_MAX_PORT_ATTEMPTS`` consecutive ports. Returns the first
    available port, or raises ``OSError`` if none are free.
    """
    for offset in range(_MAX_PORT_ATTEMPTS):
        port = start_port + offset
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise OSError(
        f"No available port found in range {start_port}-{start_port + _MAX_PORT_ATTEMPTS - 1}"
    )


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
    development installs.  If the requested port is busy, automatically
    tries the next available port (up to +20).
    """
    # Find an available port (auto-increment if busy)
    try:
        actual_port = _find_available_port(port)
    except OSError as e:
        console.print(f"[red]{e}[/red]")
        return

    if actual_port != port:
        console.print(
            f"[yellow]Port {port} is in use, using {actual_port} instead.[/yellow]"
        )

    bundled = _get_bundled_dashboard_dir()
    dev_dir = _get_dev_dashboard_dir()

    # Use static export (dashboard/out/) from dev repo if available
    static_dir = bundled
    if not static_dir and dev_dir:
        out_dir = dev_dir / "out"
        if out_dir.is_dir() and (out_dir / "index.html").is_file():
            static_dir = out_dir

    if static_dir:
        _serve_static(static_dir, actual_port)
    elif dev_dir:
        _serve_dev(dev_dir, actual_port)
    else:
        console.print("[red]No dashboard found. Install with 'pip install oh-my-agentic-score'.[/red]")


def _serve_static(static_dir: Path, port: int) -> None:
    """Serve the static dashboard build via Python HTTP server."""
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

    _open_browser_delayed(url, delay=1)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        console.print("\n[dim]Dashboard stopped.[/dim]")
    finally:
        server.server_close()


def _serve_dev(dev_dir: Path, port: int) -> None:
    """Start the Next.js dev server.

    Automatically installs dependencies if node_modules is missing,
    preferring bun over npm for speed.
    """
    import shutil
    import subprocess

    node_modules = dev_dir / "node_modules"
    if not node_modules.is_dir():
        # Auto-install dependencies (prefer bun for speed)
        pkg_mgr = "bun" if shutil.which("bun") else "npm"
        console.print(f"[yellow]Installing dashboard dependencies with {pkg_mgr}...[/yellow]")
        try:
            subprocess.run(
                [pkg_mgr, "install"],
                cwd=str(dev_dir),
                check=True,
            )
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            console.print(f"[red]Failed to install dependencies: {e}[/red]")
            console.print("[red]Install Node.js (bun or npm) and run 'npm install' in dashboard/.[/red]")
            return

    url = f"http://localhost:{port}"
    console.print(f"[bold]Starting Next.js dev dashboard at {url} ...[/bold]")

    # Use npx next to ensure we find the local binary
    _open_browser_delayed(url, delay=3)

    try:
        subprocess.run(
            ["npx", "next", "dev", "-p", str(port)],
            cwd=str(dev_dir),
        )
    except KeyboardInterrupt:
        console.print("\n[dim]Dashboard stopped.[/dim]")
    except FileNotFoundError:
        console.print("[red]npx not found. Install Node.js or use a packaged install.[/red]")


def _open_browser_delayed(url: str, delay: int = 1) -> None:
    """Open the browser after a short delay in a background thread."""

    def _open():
        import time
        time.sleep(delay)
        webbrowser.open(url)

    threading.Thread(target=_open, daemon=True).start()
