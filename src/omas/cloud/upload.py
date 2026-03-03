"""Offline-first metrics upload to OMAS Cloud."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING

from rich.console import Console

from omas.config import OMAS_DIR, UPLOAD_QUEUE_PATH
from omas.cloud.credentials import get_credentials
from omas.metrics.qualifier import is_qualified

if TYPE_CHECKING:
    from omas.models import SessionMetrics

console = Console()

MAX_RETRIES = 5


def _hash_path(path: str) -> str:
    """Hash a project path for privacy."""
    return hashlib.sha256(path.encode()).hexdigest()[:16]


def _prepare_payload(sessions: list[SessionMetrics]) -> dict:
    """Prepare upload payload with privacy protection."""
    qualified = [s for s in sessions if is_qualified(s)]
    excluded_count = len(sessions) - len(qualified)

    payload_sessions = []
    for s in qualified:
        payload_sessions.append({
            "session_id": s.session_id,
            "project_hash": _hash_path(s.project_path),
            "timestamp": s.timestamp.isoformat() if s.timestamp else None,
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

    return {
        "qualified_count": len(qualified),
        "excluded_count": excluded_count,
        "sessions": payload_sessions,
        "uploaded_at": datetime.now().isoformat(),
    }


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


def upload_metrics(sessions: list[SessionMetrics], dry_run: bool = False) -> bool:
    """Upload metrics to OMAS Cloud.

    Follows offline-first pattern:
    1. Prepare payload (hash paths, filter qualified sessions)
    2. If dry_run, just display what would be uploaded
    3. Attempt upload
    4. On failure, queue for retry
    """
    payload = _prepare_payload(sessions)

    if dry_run:
        console.print("\n[bold]Dry Run - Upload Preview[/bold]\n")
        console.print(f"  Qualified sessions: {payload['qualified_count']}")
        console.print(f"  Excluded sessions:  {payload['excluded_count']}")
        console.print(f"  Total payload size: {len(json.dumps(payload)):,} bytes")
        console.print()

        if payload['sessions']:
            console.print("  [dim]Sample session:[/dim]")
            sample = payload['sessions'][0]
            for k, v in sample.items():
                console.print(f"    {k}: {v}")

        console.print("\n[yellow]No data was uploaded (dry run mode).[/yellow]")
        return True

    # Check credentials
    creds = get_credentials()
    if not creds:
        console.print("[yellow]Not authenticated. Run 'omas auth login' first.[/yellow]")
        console.print("[dim]Metrics saved locally. Will upload when authenticated.[/dim]")
        _queue_for_retry(payload)
        return False

    # Attempt upload
    success = _do_upload(payload, creds)

    if success:
        console.print(f"[green]Uploaded {payload['qualified_count']} sessions to OMAS Cloud.[/green]")
        # Process any pending queue items
        _process_queue(creds)
    else:
        console.print("[yellow]Upload failed. Queued for retry.[/yellow]")
        _queue_for_retry(payload)

    return success


def _do_upload(payload: dict, creds: dict) -> bool:
    """Actually perform the upload HTTP request."""
    try:
        import requests
        # Cloud API not yet available - queue for later
        console.print("[dim]OMAS Cloud API not yet available. Data queued locally.[/dim]")
        return False
    except Exception as e:
        console.print(f"[red]Upload error: {e}[/red]")
        return False


def _queue_for_retry(payload: dict) -> None:
    """Add failed upload to retry queue."""
    queue = _load_queue()

    # Deduplicate by session IDs
    existing_ids = set()
    for item in queue["pending"]:
        for s in item.get("sessions", []):
            existing_ids.add(s.get("session_id"))

    new_sessions = [
        s for s in payload["sessions"]
        if s["session_id"] not in existing_ids
    ]

    if new_sessions:
        queue["pending"].append({
            "sessions": new_sessions,
            "timestamp": datetime.now().isoformat(),
            "retry_count": 0,
        })
        _save_queue(queue)
        console.print(f"[dim]Queued {len(new_sessions)} sessions for retry.[/dim]")


def _process_queue(creds: dict) -> None:
    """Process pending upload queue items."""
    queue = _load_queue()

    remaining = []
    for item in queue["pending"]:
        if item.get("retry_count", 0) >= MAX_RETRIES:
            console.print(f"[yellow]Dropping {len(item['sessions'])} sessions after {MAX_RETRIES} retries.[/yellow]")
            continue

        # Try uploading queued item
        success = _do_upload({"sessions": item["sessions"]}, creds)
        if not success:
            item["retry_count"] = item.get("retry_count", 0) + 1
            remaining.append(item)

    queue["pending"] = remaining
    queue["last_sync"] = datetime.now().isoformat()
    _save_queue(queue)
