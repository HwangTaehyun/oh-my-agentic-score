"""OAuth authentication for OMAS Cloud.

Implements the standard OAuth 2.0 Authorization Code Flow for CLI:
1. Start a temporary local HTTP server on a random port
2. Open browser to GitHub OAuth authorize URL
3. User authorizes → GitHub redirects to localhost with ?code=XXX
4. CLI captures the code
5. CLI sends code to OMAS server's LoginWithGitHub (Connect-RPC)
6. Server exchanges code for GitHub token, creates user, returns JWT
7. CLI stores JWT tokens in OS keyring

This is the same pattern used by `gh auth login` and similar CLI tools.
"""

from __future__ import annotations

import http.server
import logging
import socket
import urllib.parse
import webbrowser
from typing import Optional

from rich.console import Console
from rich.panel import Panel

from omas.cloud.api_client import ConnectRPCError, OmasCloudClient
from omas.cloud.credentials import save_credentials
from omas.config import DEFAULT_SERVER_URL

logger = logging.getLogger(__name__)
console = Console()

# The GitHub OAuth App client_id must match the server's APP_GITHUB_CLIENT_ID.
# This is the public client_id (safe to embed in CLI).
# The client_secret stays on the server side only.
DEFAULT_GITHUB_CLIENT_ID = "Ov23liuJVeWlvy5TgK2V"

# GitHub OAuth endpoints
GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"


class _OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    """HTTP handler that captures the OAuth callback ?code=... parameter."""

    code: Optional[str] = None
    error: Optional[str] = None

    def do_GET(self) -> None:
        """Handle the OAuth callback redirect."""
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)

        if "code" in params:
            _OAuthCallbackHandler.code = params["code"][0]
            self._respond(
                200,
                "<html><body style='font-family:monospace;text-align:center;padding:60px'>"
                "<h2>Authentication successful!</h2>"
                "<p>You can close this tab and return to the terminal.</p>"
                "</body></html>",
            )
        elif "error" in params:
            _OAuthCallbackHandler.error = params.get("error_description", params["error"])[0]
            self._respond(
                400,
                f"<html><body style='font-family:monospace;text-align:center;padding:60px'>"
                f"<h2>Authentication failed</h2>"
                f"<p>{_OAuthCallbackHandler.error}</p>"
                f"</body></html>",
            )
        else:
            self._respond(400, "<html><body><p>Missing code parameter</p></body></html>")

    def _respond(self, status: int, body: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(body.encode())

    def log_message(self, format: str, *args: object) -> None:  # type: ignore[override]
        """Suppress default HTTP server logging."""
        _ = format, args  # unused


def _find_free_port() -> int:
    """Find a free TCP port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait_for_callback(port: int) -> Optional[str]:
    """Start local HTTP server and wait for OAuth callback.

    Returns the authorization code, or None on timeout/error.
    """
    _OAuthCallbackHandler.code = None
    _OAuthCallbackHandler.error = None

    server = http.server.HTTPServer(("127.0.0.1", port), _OAuthCallbackHandler)
    server.timeout = 120  # 2 minute timeout

    with console.status("[bold green]Waiting for browser authorization...[/bold green]"):
        server.handle_request()

    server.server_close()

    if _OAuthCallbackHandler.error:
        console.print(f"[red]Authorization failed: {_OAuthCallbackHandler.error}[/red]")
        return None

    if not _OAuthCallbackHandler.code:
        console.print("[red]No authorization code received. Timed out or cancelled.[/red]")
        return None

    return _OAuthCallbackHandler.code


def _open_browser_for_auth(
    github_client_id: str, redirect_uri: str
) -> None:
    """Build authorize URL, display instructions, and open browser."""
    params = urllib.parse.urlencode({
        "client_id": github_client_id,
        "redirect_uri": redirect_uri,
        "scope": "read:user user:email",
    })
    authorize_url = f"{GITHUB_AUTHORIZE_URL}?{params}"

    console.print(Panel(
        f"[bold]Opening browser for GitHub authorization...[/bold]\n\n"
        f"If browser doesn't open, visit:\n"
        f"[cyan underline]{authorize_url}[/cyan underline]",
        title="[bold]GitHub OAuth Login[/bold]",
        border_style="green",
        padding=(1, 2),
    ))

    try:
        webbrowser.open(authorize_url)
        console.print("[dim]Browser opened automatically.[/dim]\n")
    except Exception:
        console.print("[dim]Please open the URL above in your browser.[/dim]\n")


def _exchange_code_with_server(
    code: str, redirect_uri: str, server_url: str
) -> Optional[dict]:
    """Send authorization code to OMAS server, return token response.

    Returns the full response dict or None on failure.
    """
    console.print("[dim]Exchanging code with OMAS Cloud server...[/dim]")

    client = OmasCloudClient(base_url=server_url)

    try:
        return client.login_with_github(code=code, redirect_uri=redirect_uri)
    except ConnectRPCError as e:
        console.print(f"[red]Server authentication failed: {e.message}[/red]")
        if e.code == "unavailable":
            console.print("[dim]Is the OMAS Cloud server running?[/dim]")
        return None
    except Exception as e:
        console.print(f"[red]Authentication error: {e}[/red]")
        return None


def _save_and_display_result(result: dict, server_url: str) -> bool:
    """Extract tokens from server response, save credentials, display welcome.

    Returns True on success.
    """
    access_token = result.get("access_token", result.get("accessToken", ""))
    refresh_token = result.get("refresh_token", result.get("refreshToken", ""))
    user = result.get("user", {})

    if not access_token:
        console.print("[red]Server did not return an access token.[/red]")
        return False

    username = user.get("username", "")
    display_name = user.get("display_name", user.get("displayName", username))

    save_credentials(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
        server_url=server_url,
    )

    console.print(f"\n[bold green]Welcome, {display_name}![/bold green]  (@{username})")
    console.print("[dim]Credentials saved to OS keychain.[/dim]")
    console.print(f"[dim]Server: {server_url}[/dim]")
    console.print("[dim]Run 'omas auth status' to verify.[/dim]")

    return True


def start_oauth_flow(
    server_url: str = DEFAULT_SERVER_URL,
    github_client_id: str = DEFAULT_GITHUB_CLIENT_ID,
) -> bool:
    """Start the OAuth Authorization Code Flow for GitHub.

    Args:
        server_url: OMAS Cloud server URL
        github_client_id: GitHub OAuth App client ID (must match server's)

    Returns:
        True if authentication succeeded.
    """
    console.print("\n[bold]Authenticating with GitHub...[/bold]\n")

    port = _find_free_port()
    redirect_uri = f"http://localhost:{port}/callback"

    _open_browser_for_auth(github_client_id, redirect_uri)

    code = _wait_for_callback(port)
    if not code:
        return False

    console.print("[green]Authorization code received![/green]")

    result = _exchange_code_with_server(code, redirect_uri, server_url)
    if not result:
        return False

    return _save_and_display_result(result, server_url)


def refresh_access_token(server_url: str = DEFAULT_SERVER_URL) -> bool:
    """Refresh the access token using the stored refresh token.

    Returns True if refresh succeeded.
    """
    from omas.cloud.credentials import get_refresh_token, update_access_token

    token = get_refresh_token()
    if not token:
        logger.debug("No refresh token available")
        return False

    client = OmasCloudClient(base_url=server_url)

    try:
        result = client.refresh_token(token)
    except ConnectRPCError:
        logger.debug("Token refresh failed", exc_info=True)
        return False

    new_access = result.get("access_token", result.get("accessToken", ""))
    new_refresh = result.get("refresh_token", result.get("refreshToken", ""))

    if new_access:
        update_access_token(new_access, new_refresh or None)
        return True

    return False
