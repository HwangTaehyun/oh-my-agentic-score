"""Credential management using OS-native keyring."""

from __future__ import annotations

import json
from typing import Optional

SERVICE_NAME = "oh-my-agentic-score"


def save_credentials(provider: str, token: str, username: str = "") -> None:
    """Save OAuth credentials to OS keyring."""
    import keyring

    data = json.dumps({
        "provider": provider,
        "token": token,
        "username": username,
    })
    keyring.set_password(SERVICE_NAME, "default", data)


def get_credentials() -> Optional[dict]:
    """Retrieve stored credentials from OS keyring."""
    try:
        import keyring
        data = keyring.get_password(SERVICE_NAME, "default")
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


def clear_credentials() -> None:
    """Remove stored credentials from OS keyring."""
    try:
        import keyring
        keyring.delete_password(SERVICE_NAME, "default")
    except Exception:
        pass
