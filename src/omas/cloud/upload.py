"""Offline-first metrics upload to OMAS Cloud.

Data flow:
    1. CLI computes metrics locally (always saved to SQLite first)
    2. Qualified sessions are prepared as Connect-RPC payload
    3. Upload attempted via ScoreService.UploadSessions
    4. On failure → queued to ~/.omas/upload_queue.json for retry
    5. On next run → pending queue items retried automatically
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime
from typing import TYPE_CHECKING

from rich.console import Console

from omas.cloud.api_client import ConnectRPCError, OmasCloudClient
from omas.cloud.credentials import get_access_token, get_credentials
from omas.config import DEFAULT_SERVER_URL, OMAS_DIR, UPLOAD_QUEUE_PATH
from omas.metrics.qualifier import is_qualified

if TYPE_CHECKING:
    from omas.models import SessionMetrics

console = Console()

MAX_RETRIES = 5


def _hash_path(path: str) -> str:
    """Hash a project path for privacy (only hash is transmitted)."""
    return hashlib.sha256(path.encode()).hexdigest()[:16]


def _build_session_payloads(
    sessions: list[SessionMetrics],
) -> list[dict]:
    """Convert SessionMetrics list to Connect-RPC SessionUpload dicts.

    Field names match the proto `SessionUpload` message exactly.
    """
    payloads = []
    for s in sessions:
        payloads.append({
            "session_id": s.session_id,
            "project_hash": _hash_path(s.project_path) if s.project_path else s.project_hash,
            "timestamp": s.timestamp.isoformat() if s.timestamp else "",
            "model": s.model,
            "thread_type": s.thread_type.value,
            "session_duration_minutes": s.session_duration_minutes,
            "total_tool_calls": s.total_tool_calls,
            "total_human_messages": s.total_human_messages,
            "overall_score": s.overall_score,
            "p_thread_score": s.parallelism.p_thread_score,
            "l_thread_score": s.autonomy.l_thread_score,
            "b_thread_score": s.density.b_thread_score,
            "z_thread_score": s.trust.z_thread_score,
        })
    return payloads


def _build_project_payloads(
    sessions: list[SessionMetrics],
) -> list[dict]:
    """Build Connect-RPC ProjectUpload dicts from sessions.

    Groups sessions by project and computes per-project aggregates
    matching the proto `ProjectUpload` message.
    """
    project_sessions: dict[str, list[SessionMetrics]] = defaultdict(list)
    for s in sessions:
        key = _hash_path(s.project_path) if s.project_path else s.project_hash
        project_sessions[key].append(s)

    payloads = []
    for project_hash, proj_sessions in project_sessions.items():
        type_counts = Counter(s.thread_type.value for s in proj_sessions)
        dominant = max(type_counts, key=lambda k: type_counts[k])

        payloads.append({
            "project_hash": project_hash,
            "session_count": len(proj_sessions),
            "total_tool_calls": sum(s.total_tool_calls for s in proj_sessions),
            "avg_p_score": _avg([s.parallelism.p_thread_score for s in proj_sessions]),
            "avg_l_score": _avg([s.autonomy.l_thread_score for s in proj_sessions]),
            "avg_b_score": _avg([s.density.b_thread_score for s in proj_sessions]),
            "avg_z_score": _avg([s.trust.z_thread_score for s in proj_sessions]),
            "avg_overall_score": _avg([s.overall_score for s in proj_sessions]),
            "dominant_thread_type": dominant,
            "thread_type_distribution": dict(type_counts),
        })

    return payloads


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def _load_queue() -> dict:
    """Load the upload queue from disk."""
    if UPLOAD_QUEUE_PATH.exists():
        try:
            return json.loads(UPLOAD_QUEUE_PATH.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {"pending": [], "last_sync": None}


def _save_queue(queue: dict) -> None:
    """Save the upload queue to disk."""
    OMAS_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_QUEUE_PATH.write_text(json.dumps(queue, indent=2))


def _display_dry_run(
    qualified: list[SessionMetrics], excluded_count: int
) -> None:
    """Display what would be uploaded without actually uploading."""
    session_payloads = _build_session_payloads(qualified)
    project_payloads = _build_project_payloads(qualified)

    console.print("\n[bold]Dry Run - Upload Preview[/bold]\n")
    console.print(f"  Qualified sessions: {len(qualified)}")
    console.print(f"  Excluded sessions:  {excluded_count}")
    console.print(f"  Projects:           {len(project_payloads)}")

    payload_size = len(json.dumps({
        "sessions": session_payloads,
        "projects": project_payloads,
    }))
    console.print(f"  Payload size:       {payload_size:,} bytes")

    if session_payloads:
        console.print("\n  [dim]Sample session:[/dim]")
        for k, v in session_payloads[0].items():
            console.print(f"    {k}: {v}")

    console.print("\n[yellow]No data was uploaded (dry run mode).[/yellow]")


def _send_upload(client: OmasCloudClient, sessions: list[dict], projects: list[dict]) -> dict:
    """Send the upload request via Connect-RPC. Raises on failure."""
    return client.upload_sessions(sessions=sessions, projects=projects)


def _retry_with_refreshed_token(
    client: OmasCloudClient,
    server_url: str,
    session_payloads: list[dict],
    project_payloads: list[dict],
) -> dict | None:
    """Attempt token refresh and retry the upload once.

    Returns the server response dict on success, None on failure.
    """
    console.print("[yellow]Access token expired. Trying refresh...[/yellow]")
    from omas.cloud.auth import refresh_access_token

    if not refresh_access_token(server_url=server_url):
        console.print("[red]Token refresh failed. Run 'omas auth login'.[/red]")
        return None

    new_token = get_access_token()
    if not new_token:
        console.print("[red]Token refresh failed. Run 'omas auth login'.[/red]")
        return None

    client.set_token(new_token)
    try:
        return _send_upload(client, session_payloads, project_payloads)
    except ConnectRPCError as e:
        console.print(f"[red]Upload failed after refresh: {e.message}[/red]")
        return None


def _do_upload(
    qualified: list[SessionMetrics],
    server_url: str,
    access_token: str,
) -> dict | None:
    """Perform the actual Connect-RPC upload.

    Returns the server response dict on success, None on failure.
    """
    session_payloads = _build_session_payloads(qualified)
    project_payloads = _build_project_payloads(qualified)
    client = OmasCloudClient(base_url=server_url, token=access_token)

    try:
        return _send_upload(client, session_payloads, project_payloads)
    except ConnectRPCError as e:
        if e.code == "unauthenticated":
            return _retry_with_refreshed_token(
                client, server_url, session_payloads, project_payloads
            )
        console.print(f"[red]Upload failed: {e.message}[/red]")
        return None
    except Exception as e:
        console.print(f"[red]Upload error: {e}[/red]")
        return None


def _queue_for_retry(sessions: list[dict]) -> None:
    """Add failed upload sessions to retry queue."""
    queue = _load_queue()

    existing_ids = set()
    for item in queue["pending"]:
        for s in item.get("sessions", []):
            existing_ids.add(s.get("session_id"))

    new_sessions = [s for s in sessions if s["session_id"] not in existing_ids]

    if new_sessions:
        queue["pending"].append({
            "sessions": new_sessions,
            "timestamp": datetime.now().isoformat(),
            "retry_count": 0,
        })
        _save_queue(queue)
        console.print(f"[dim]Queued {len(new_sessions)} sessions for retry.[/dim]")


def upload_metrics(
    sessions: list[SessionMetrics],
    dry_run: bool = False,
    server_url: str = DEFAULT_SERVER_URL,
) -> bool:
    """Upload session metrics to OMAS Cloud.

    Args:
        sessions: All locally stored session metrics
        dry_run: If True, only preview what would be uploaded
        server_url: OMAS Cloud server URL

    Returns:
        True if upload succeeded (or dry_run completed).
    """
    qualified = [s for s in sessions if is_qualified(s)]
    excluded_count = len(sessions) - len(qualified)

    if not qualified:
        console.print("[yellow]No qualified sessions to upload.[/yellow]")
        return False

    if dry_run:
        _display_dry_run(qualified, excluded_count)
        return True

    creds = get_credentials()
    if not creds or not creds.get("access_token"):
        console.print("[yellow]Not authenticated. Run 'omas auth login' first.[/yellow]")
        console.print("[dim]Metrics saved locally. Will upload when authenticated.[/dim]")
        _queue_for_retry(_build_session_payloads(qualified))
        return False

    access_token = creds["access_token"]
    url = creds.get("server_url", server_url)

    result = _do_upload(qualified, url, access_token)

    if result:
        inserted = result.get("inserted_count", result.get("insertedCount", 0))
        dupes = result.get("duplicate_count", result.get("duplicateCount", 0))
        projects = result.get("project_count", result.get("projectCount", 0))
        console.print(
            f"[green]Uploaded: {inserted} new, {dupes} duplicate, "
            f"{projects} projects[/green]"
        )
        return True

    _queue_for_retry(_build_session_payloads(qualified))
    return False
