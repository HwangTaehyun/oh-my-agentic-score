"""OAuth Device Flow authentication for OMAS Cloud.

Implements the standard OAuth 2.0 Device Authorization Grant (RFC 8628).
Works like `gh auth login` — gives the user a URL + code, polls until authorized.
"""

from __future__ import annotations

import time
import webbrowser

import requests
from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from omas.cloud.credentials import save_credentials

console = Console()

# Cloud API base URL (configurable for self-hosted instances)
OMAS_CLOUD_URL = "https://api.omas.dev"

# OAuth app credentials (public client IDs — safe to embed in CLI)
OAUTH_APPS = {
    "github": {
        "client_id": "Ov23liuJVeWlvy5TgK2V",
        "device_auth_url": "https://github.com/login/device/code",
        "token_url": "https://github.com/login/oauth/access_token",
        "user_api_url": "https://api.github.com/user",
        "scopes": "read:user user:email",
    },
    "google": {
        "client_id": "XXXXXXXXXXXX.apps.googleusercontent.com",  # TODO: Replace after registering
        "device_auth_url": "https://oauth2.googleapis.com/device/code",
        "token_url": "https://oauth2.googleapis.com/token",
        "user_api_url": "https://www.googleapis.com/oauth2/v2/userinfo",
        "scopes": "openid email profile",
    },
}


def _request_device_code(provider: str) -> dict | None:
    """Step 1: Request a device code from the OAuth provider.

    Returns dict with device_code, user_code, verification_uri, interval, expires_in.
    """
    config = OAUTH_APPS[provider]

    try:
        resp = requests.post(
            config["device_auth_url"],
            data={
                "client_id": config["client_id"],
                "scope": config["scopes"],
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        console.print(f"[red]Failed to request device code: {e}[/red]")
        return None


def _poll_for_token(provider: str, device_code: str, interval: int = 5, expires_in: int = 900) -> str | None:
    """Step 3: Poll the token endpoint until the user authorizes.

    Returns the access token string, or None on failure/timeout.
    """
    config = OAUTH_APPS[provider]
    start_time = time.time()

    grant_type = "urn:ietf:params:oauth:grant-type:device_code"

    with console.status("[bold green]Waiting for browser authorization...[/bold green]", spinner="dots"):
        while time.time() - start_time < expires_in:
            time.sleep(interval)

            try:
                resp = requests.post(
                    config["token_url"],
                    data={
                        "client_id": config["client_id"],
                        "device_code": device_code,
                        "grant_type": grant_type,
                    },
                    headers={"Accept": "application/json"},
                    timeout=10,
                )
                data = resp.json()
            except requests.RequestException:
                continue

            # Success — token received
            if "access_token" in data:
                return data["access_token"]

            error = data.get("error", "")

            if error == "authorization_pending":
                # User hasn't authorized yet, keep polling
                continue
            elif error == "slow_down":
                # Server asks us to slow down
                interval += 5
                continue
            elif error == "expired_token":
                console.print("[red]Device code expired. Please try again.[/red]")
                return None
            elif error == "access_denied":
                console.print("[red]Authorization denied by user.[/red]")
                return None
            else:
                console.print(f"[red]Unexpected error: {error}[/red]")
                return None

    console.print("[red]Timed out waiting for authorization.[/red]")
    return None


def _fetch_user_info(provider: str, token: str) -> dict | None:
    """Fetch user profile from the provider API using the access token."""
    config = OAUTH_APPS[provider]

    try:
        resp = requests.get(
            config["user_api_url"],
            headers={
                "Authorization": f"Bearer {token}" if provider == "google" else f"token {token}",
                "Accept": "application/json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        console.print(f"[yellow]Warning: Could not fetch user info: {e}[/yellow]")
        return None


def start_device_flow(provider: str = "github") -> bool:
    """Start OAuth Device Flow for the given provider.

    Flow:
    1. Request device code from provider
    2. Display verification URL + user code
    3. Open browser automatically
    4. Poll until user completes authorization
    5. Fetch user profile
    6. Save credentials to OS keyring

    Returns True if authentication succeeded.
    """
    if provider not in OAUTH_APPS:
        console.print(f"[red]Unknown provider: {provider}[/red]")
        return False

    console.print(f"\n[bold]Authenticating with {provider.title()}...[/bold]\n")

    # Step 1: Request device code
    device_data = _request_device_code(provider)
    if not device_data:
        return False

    user_code = device_data.get("user_code", "")
    verification_uri = device_data.get("verification_uri", device_data.get("verification_url", ""))
    device_code = device_data.get("device_code", "")
    interval = device_data.get("interval", 5)
    expires_in = device_data.get("expires_in", 900)

    if not user_code or not verification_uri or not device_code:
        console.print("[red]Invalid response from provider.[/red]")
        return False

    # Step 2: Display the code and URL to the user
    code_display = Text(user_code, style="bold green")

    panel_content = Text.assemble(
        ("First, copy your one-time code: ", ""),
        code_display,
        ("\n\n", ""),
        ("Then open: ", ""),
        (verification_uri, "bold underline cyan"),
        ("\n\n", ""),
        ("Waiting for authorization...", "dim"),
    )

    console.print(Panel(
        panel_content,
        title=f"[bold]{provider.title()} Device Authorization[/bold]",
        border_style="green",
        padding=(1, 2),
    ))

    # Try to open browser automatically
    try:
        webbrowser.open(verification_uri)
        console.print("[dim]Browser opened automatically.[/dim]\n")
    except Exception:
        console.print("[dim]Please open the URL above in your browser.[/dim]\n")

    # Step 3: Poll for token
    token = _poll_for_token(provider, device_code, interval, expires_in)
    if not token:
        return False

    console.print("[bold green]Authorization successful![/bold green]\n")

    # Step 4: Fetch user info
    user_info = _fetch_user_info(provider, token)
    username = ""
    if user_info:
        if provider == "github":
            username = user_info.get("login", "")
            name = user_info.get("name", username)
            avatar = user_info.get("avatar_url", "")
            console.print(f"[green]Welcome, {name}![/green]  (@{username})")
        elif provider == "google":
            username = user_info.get("email", "")
            name = user_info.get("name", username)
            console.print(f"[green]Welcome, {name}![/green]  ({username})")

    # Step 5: Save credentials
    save_credentials(provider=provider, token=token, username=username)
    console.print(f"\n[dim]Credentials saved to OS keychain.[/dim]")
    console.print(f"[dim]Run 'omas auth status' to verify.[/dim]")

    return True
