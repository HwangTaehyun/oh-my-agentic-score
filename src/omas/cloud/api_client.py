"""Connect-RPC client for OMAS Cloud API.

The server uses Connect-RPC (connectrpc.com) protocol — all RPCs are
HTTP POST requests with JSON bodies to paths like:
    POST /omas.cloud.v1.ScoreService/UploadSessions

Required headers:
    Content-Type: application/json
    Connect-Protocol-Version: 1
    Authorization: Bearer <jwt_access_token>   (for protected endpoints)
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import requests

from omas.config import DEFAULT_SERVER_URL

logger = logging.getLogger(__name__)

# Connect-RPC service base paths
_AUTH_SERVICE = "omas.cloud.v1.AuthService"
_SCORE_SERVICE = "omas.cloud.v1.ScoreService"
_LEADERBOARD_SERVICE = "omas.cloud.v1.LeaderboardService"
_DASHBOARD_SERVICE = "omas.cloud.v1.DashboardService"
_TREND_SERVICE = "omas.cloud.v1.TrendService"


class ConnectRPCError(Exception):
    """Error from a Connect-RPC call."""

    def __init__(self, code: str, message: str, status_code: int = 0):
        self.code = code
        self.message = message
        self.status_code = status_code
        super().__init__(f"[{code}] {message}")


def _get_cli_version() -> str:
    """Get package version for User-Agent header."""
    try:
        from importlib.metadata import version
        return version("oh-my-agentic-score")
    except Exception:
        return "0.0.0"


class OmasCloudClient:
    """Connect-RPC client for communicating with OMAS Cloud API.

    Services:
        AuthService       — LoginWithGitHub, RefreshToken, GetMe, UpdateProfile
        ScoreService      — UploadSessions, GetMySessions, GetMyScoreSummary, ...
        LeaderboardService — GetGlobalLeaderboard, GetCountryRankings
        DashboardService  — GetLandingStats, GetTopUsers
        TrendService      — GetCommunityTrends, GetScoreChart, ...
    """

    def __init__(self, base_url: str = DEFAULT_SERVER_URL, token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({
            "Content-Type": "application/json",
            "Connect-Protocol-Version": "1",
            "User-Agent": f"omas-cli/{_get_cli_version()}",
        })
        if token:
            self.set_token(token)

    def set_token(self, token: str) -> None:
        """Set the JWT access token for authenticated requests."""
        self.session.headers["Authorization"] = f"Bearer {token}"

    def clear_token(self) -> None:
        """Remove the JWT access token."""
        self.session.headers.pop("Authorization", None)

    # ─── Low-level RPC call ───────────────────────────────────────

    def _rpc(self, service: str, method: str, payload: dict | None = None) -> dict:
        """Make a Connect-RPC unary call.

        Args:
            service: e.g. "omas.cloud.v1.ScoreService"
            method: e.g. "UploadSessions"
            payload: JSON-serializable request body (empty dict if None)

        Returns:
            Parsed JSON response body.

        Raises:
            ConnectRPCError: on Connect-level errors
            requests.HTTPError: on transport errors
        """
        url = f"{self.base_url}/{service}/{method}"
        body = payload or {}

        try:
            resp = self.session.post(url, json=body, timeout=30)
        except requests.ConnectionError:
            raise ConnectRPCError(
                code="unavailable",
                message=f"Cannot connect to OMAS Cloud at {self.base_url}",
            )
        except requests.Timeout:
            raise ConnectRPCError(
                code="deadline_exceeded",
                message="Request timed out",
            )

        # Connect-RPC returns errors as JSON with "code" and "message"
        if resp.status_code != 200:
            try:
                err = resp.json()
                raise ConnectRPCError(
                    code=err.get("code", "unknown"),
                    message=err.get("message", resp.text),
                    status_code=resp.status_code,
                )
            except (ValueError, KeyError):
                resp.raise_for_status()

        return resp.json()

    # ─── Health Check ─────────────────────────────────────────────

    def health(self) -> dict:
        """Check server health (plain HTTP GET, not Connect-RPC)."""
        resp = self.session.get(f"{self.base_url}/health", timeout=5)
        resp.raise_for_status()
        return resp.json()

    # ─── AuthService ──────────────────────────────────────────────

    def login_with_github(self, code: str, redirect_uri: str) -> dict:
        """Exchange GitHub OAuth authorization code for JWT tokens (Web flow).

        Returns: {access_token, refresh_token, user: {id, username, ...}}
        """
        return self._rpc(_AUTH_SERVICE, "LoginWithGitHub", {
            "code": code,
            "redirect_uri": redirect_uri,
        })

    def login_with_github_token(self, github_token: str) -> dict:
        """Exchange a GitHub access token for JWT tokens (CLI Device Flow).

        Returns: {access_token, refresh_token, user: {id, username, ...}}
        """
        return self._rpc(_AUTH_SERVICE, "LoginWithGitHub", {
            "github_token": github_token,
        })

    def refresh_token(self, refresh_token: str) -> dict:
        """Refresh an expired access token.

        Returns: {access_token, refresh_token}
        """
        return self._rpc(_AUTH_SERVICE, "RefreshToken", {
            "refresh_token": refresh_token,
        })

    def get_me(self) -> dict:
        """Get the current authenticated user's profile.

        Returns: {user: {id, username, display_name, avatar_url, ...}}
        """
        return self._rpc(_AUTH_SERVICE, "GetMe", {})

    def update_profile(self, **kwargs: Any) -> dict:
        """Update the current user's profile.

        Keyword Args:
            country_code, bio, display_name (all optional)

        Returns: {user: {...}}
        """
        return self._rpc(_AUTH_SERVICE, "UpdateProfile", kwargs)

    # ─── ScoreService ─────────────────────────────────────────────

    def upload_sessions(
        self,
        sessions: list[dict],
        projects: list[dict] | None = None,
    ) -> dict:
        """Upload session metrics and project summaries.

        Args:
            sessions: list of SessionUpload dicts
            projects: list of ProjectUpload dicts (optional)

        Returns: {inserted_count, duplicate_count, project_count}
        """
        payload: dict[str, Any] = {"sessions": sessions}
        if projects:
            payload["projects"] = projects
        return self._rpc(_SCORE_SERVICE, "UploadSessions", payload)

    def get_my_sessions(
        self, page: int = 1, page_size: int = 20
    ) -> dict:
        """Get the current user's uploaded sessions."""
        return self._rpc(_SCORE_SERVICE, "GetMySessions", {
            "page": page,
            "page_size": page_size,
        })

    def get_my_score_summary(self) -> dict:
        """Get the current user's score summary."""
        return self._rpc(_SCORE_SERVICE, "GetMyScoreSummary", {})

    def get_my_projects(self) -> dict:
        """Get the current user's projects."""
        return self._rpc(_SCORE_SERVICE, "GetMyProjects", {})

    def get_my_achievements(self) -> dict:
        """Get the current user's achievements."""
        return self._rpc(_SCORE_SERVICE, "GetMyAchievements", {})

    # ─── LeaderboardService ───────────────────────────────────────

    def get_global_leaderboard(
        self,
        period: str = "PERIOD_ALL_TIME",
        page: int = 1,
        page_size: int = 20,
        search: str = "",
    ) -> dict:
        """Get global leaderboard rankings.

        Period values: PERIOD_DAILY, PERIOD_WEEKLY, PERIOD_MONTHLY,
                       PERIOD_YEARLY, PERIOD_ALL_TIME
        """
        return self._rpc(_LEADERBOARD_SERVICE, "GetGlobalLeaderboard", {
            "period": period,
            "page": page,
            "page_size": page_size,
            "search": search,
        })

    def get_country_rankings(
        self, period: str = "PERIOD_ALL_TIME"
    ) -> dict:
        """Get country-level rankings."""
        return self._rpc(_LEADERBOARD_SERVICE, "GetCountryRankings", {
            "period": period,
        })

    # ─── DashboardService ────────────────────────────────────────

    def get_landing_stats(self) -> dict:
        """Get landing page statistics (public, no auth required)."""
        return self._rpc(_DASHBOARD_SERVICE, "GetLandingStats", {})

    def get_top_users(self, limit: int = 5) -> dict:
        """Get top users for landing page."""
        return self._rpc(_DASHBOARD_SERVICE, "GetTopUsers", {
            "limit": limit,
        })

    # ─── TrendService ────────────────────────────────────────────

    def get_community_trends(self, period: str = "PERIOD_WEEKLY") -> dict:
        """Get community-wide trend statistics."""
        return self._rpc(_TREND_SERVICE, "GetCommunityTrends", {
            "period": period,
        })

    def get_score_chart(self, period: str = "PERIOD_WEEKLY") -> dict:
        """Get score chart data over time."""
        return self._rpc(_TREND_SERVICE, "GetScoreChart", {
            "period": period,
        })

    def get_thread_evolution(self, period: str = "PERIOD_WEEKLY") -> dict:
        """Get thread type evolution over time."""
        return self._rpc(_TREND_SERVICE, "GetThreadEvolution", {
            "period": period,
        })

    def get_active_users_chart(self, period: str = "PERIOD_WEEKLY") -> dict:
        """Get active users chart data."""
        return self._rpc(_TREND_SERVICE, "GetActiveUsersChart", {
            "period": period,
        })
