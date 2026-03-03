"""HTTP client for OMAS Cloud API."""

from __future__ import annotations

from typing import Optional

import requests

# Default cloud API base URL
DEFAULT_API_URL = "https://api.omas.dev"


class OmasCloudClient:
    """HTTP client for communicating with OMAS Cloud API.

    Endpoints (server-side not yet implemented):
    - POST /api/v1/auth/verify - Verify OAuth token
    - POST /api/v1/metrics/upload - Upload session metrics
    - GET  /api/v1/metrics/me - Get user's own metrics
    - GET  /api/v1/leaderboard - Global leaderboard (future)
    """

    def __init__(self, base_url: str = DEFAULT_API_URL, token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"
        self.session.headers["Content-Type"] = "application/json"
        self.session.headers["User-Agent"] = "omas-cli/0.1.0"

    def verify_token(self) -> dict:
        """Verify the current token with the server."""
        resp = self.session.post(f"{self.base_url}/api/v1/auth/verify")
        resp.raise_for_status()
        return resp.json()

    def upload_metrics(self, payload: dict) -> dict:
        """Upload session metrics."""
        resp = self.session.post(
            f"{self.base_url}/api/v1/metrics/upload",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    def get_my_metrics(self) -> dict:
        """Get the authenticated user's metrics."""
        resp = self.session.get(f"{self.base_url}/api/v1/metrics/me")
        resp.raise_for_status()
        return resp.json()
