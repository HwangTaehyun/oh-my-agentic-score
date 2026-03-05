"""OAuth authentication for OMAS Cloud.

Implements the GitHub Device Flow for CLI:
1. CLI requests a device code from GitHub
2. User visits verification URL and enters the user code
3. CLI polls GitHub until the user authorizes
4. CLI gets a GitHub access token
5. CLI sends the token to OMAS server's LoginWithGitHub (Connect-RPC)
6. Server verifies token, creates/updates user, returns JWT
7. CLI stores JWT tokens in OS keyring

This is the same pattern used by `gh auth login` for CLI-based auth.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

import requests
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

# GitHub Device Flow endpoints
GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code"
GITHUB_DEVICE_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_DEVICE_VERIFY_URL = "https://github.com/login/device"


def _request_device_code(github_client_id: str) -> Optional[dict]:
    """Request a device code from GitHub for the Device Flow.

    Returns dict with: device_code, user_code, verification_uri, expires_in, interval
    """
    try:
        resp = requests.post(
            GITHUB_DEVICE_CODE_URL,
            json={
                "client_id": github_client_id,
                "scope": "read:user user:email",
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        if "error" in data:
            console.print(f"[red]GitHub error: {data.get('error_description', data['error'])}[/red]")
            return None

        return data
    except requests.RequestException as e:
        console.print(f"[red]Failed to request device code: {e}[/red]")
        return None


def _poll_for_token(
    github_client_id: str, device_code: str, interval: int, expires_in: int
) -> Optional[str]:
    """Poll GitHub for the access token until user authorizes or timeout.

    Returns the GitHub access token, or None on failure/timeout.
    """
    deadline = time.time() + expires_in
    poll_interval = max(interval, 5)  # GitHub requires minimum 5 seconds

    with console.status("[bold green]Waiting for authorization...[/bold green]"):
        while time.time() < deadline:
            time.sleep(poll_interval)

            try:
                resp = requests.post(
                    GITHUB_DEVICE_TOKEN_URL,
                    json={
                        "client_id": github_client_id,
                        "device_code": device_code,
                        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    },
                    headers={"Accept": "application/json"},
                    timeout=10,
                )
                data = resp.json()
            except requests.RequestException:
                continue

            error = data.get("error")

            if error == "authorization_pending":
                # User hasn't authorized yet, keep polling
                continue
            elif error == "slow_down":
                # GitHub wants us to slow down
                poll_interval += 5
                continue
            elif error == "expired_token":
                console.print("[red]Device code expired. Please try again.[/red]")
                return None
            elif error == "access_denied":
                console.print("[red]Authorization denied by user.[/red]")
                return None
            elif error:
                console.print(f"[red]GitHub error: {data.get('error_description', error)}[/red]")
                return None

            # Success — got access token
            token = data.get("access_token")
            if token:
                return token

    console.print("[red]Authorization timed out. Please try again.[/red]")
    return None


def _exchange_token_with_server(
    github_token: str, server_url: str
) -> Optional[dict]:
    """Send GitHub access token to OMAS server, return JWT response.

    Returns the full response dict or None on failure.
    """
    console.print("[dim]Exchanging token with OMAS Cloud server...[/dim]")

    client = OmasCloudClient(base_url=server_url)

    try:
        return client.login_with_github_token(github_token=github_token)
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
    """Start the GitHub Device Flow for CLI authentication.

    Args:
        server_url: OMAS Cloud server URL
        github_client_id: GitHub OAuth App client ID (must match server's)

    Returns:
        True if authentication succeeded.
    """
    console.print("\n[bold]Authenticating with GitHub...[/bold]\n")

    # Step 1: Request device code
    device_data = _request_device_code(github_client_id)
    if not device_data:
        return False

    user_code = device_data["user_code"]
    verification_uri = device_data.get("verification_uri", GITHUB_DEVICE_VERIFY_URL)
    device_code = device_data["device_code"]
    interval = device_data.get("interval", 5)
    expires_in = device_data.get("expires_in", 900)

    # Step 2: Display user code and verification URL
    console.print(Panel(
        f"[bold]Enter this code on GitHub:[/bold]\n\n"
        f"  [bold cyan]{user_code}[/bold cyan]\n\n"
        f"Visit: [cyan underline]{verification_uri}[/cyan underline]",
        title="[bold]GitHub Device Authorization[/bold]",
        border_style="green",
        padding=(1, 2),
    ))

    # Try to open browser
    import webbrowser
    try:
        webbrowser.open(verification_uri)
        console.print("[dim]Browser opened automatically.[/dim]\n")
    except Exception:
        console.print("[dim]Please open the URL above in your browser.[/dim]\n")

    # Step 3: Poll for authorization
    github_token = _poll_for_token(github_client_id, device_code, interval, expires_in)
    if not github_token:
        return False

    console.print("[green]GitHub authorization successful![/green]")

    # Step 4: Exchange GitHub token with OMAS server for JWT
    result = _exchange_token_with_server(github_token, server_url)
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
