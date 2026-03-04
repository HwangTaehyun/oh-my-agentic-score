"""JWT credential management using OS-native keyring.

Stores OMAS Cloud JWT tokens (access + refresh) and user profile
in the OS keyring (macOS Keychain / Linux Secret Service / Windows Credential Locker).

Token lifecycle:
    1. `omas auth login` → OAuth flow → server returns JWT tokens → save_credentials()
    2. API calls read credentials via get_credentials() → use access_token
    3. On 401/expired → refresh_access_token() using refresh_token
    4. `omas auth logout` → clear_credentials()
"""

from __future__ import annotations

import json
import logging
from typing import Optional

SERVICE_NAME = "oh-my-agentic-score"

logger = logging.getLogger(__name__)


def save_credentials(
    access_token: str,
    refresh_token: str,
    user: dict | None = None,
    server_url: str = "",
) -> None:
    """Save JWT credentials to OS keyring.

    Args:
        access_token: OMAS Cloud JWT access token (short-lived, ~15min)
        refresh_token: OMAS Cloud JWT refresh token (long-lived, ~7 days)
        user: User profile dict from server {id, username, display_name, avatar_url, ...}
        server_url: The server URL these credentials are for
    """
    import keyring

    data = json.dumps({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user or {},
        "server_url": server_url,
    })
    keyring.set_password(SERVICE_NAME, "default", data)


def get_credentials() -> Optional[dict]:
    """Retrieve stored JWT credentials from OS keyring.

    Returns:
        Dict with keys: access_token, refresh_token, user, server_url
        or None if not authenticated.
    """
    try:
        import keyring

        data = keyring.get_password(SERVICE_NAME, "default")
        if data:
            return json.loads(data)
    except Exception:
        logger.debug("Failed to read credentials from keyring", exc_info=True)
    return None


def get_access_token() -> Optional[str]:
    """Convenience: get just the access token."""
    creds = get_credentials()
    return creds.get("access_token") if creds else None


def get_refresh_token() -> Optional[str]:
    """Convenience: get just the refresh token."""
    creds = get_credentials()
    return creds.get("refresh_token") if creds else None


def get_username() -> Optional[str]:
    """Convenience: get the stored username."""
    creds = get_credentials()
    if creds and creds.get("user"):
        return creds["user"].get("username")
    return None


def update_access_token(new_access_token: str, new_refresh_token: str | None = None) -> None:
    """Update the access token (and optionally refresh token) after a refresh.

    This preserves user info and server_url.
    """
    creds = get_credentials()
    if not creds:
        logger.warning("Cannot update token: no existing credentials")
        return

    creds["access_token"] = new_access_token
    if new_refresh_token:
        creds["refresh_token"] = new_refresh_token

    import keyring

    keyring.set_password(SERVICE_NAME, "default", json.dumps(creds))


def clear_credentials() -> None:
    """Remove stored credentials from OS keyring."""
    try:
        import keyring

        keyring.delete_password(SERVICE_NAME, "default")
    except Exception:
        logger.debug("Failed to clear credentials", exc_info=True)
