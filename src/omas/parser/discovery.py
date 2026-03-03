"""Discover Claude Code session JSONL files."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from omas.config import CLAUDE_PROJECTS_DIR


def decode_project_hash(project_hash: str) -> str:
    """Convert a project directory hash to a human-readable path.

    Rules (derived from real Claude Code data):
    - Leading '-' becomes '/'
    - Each '-' becomes '/'
    - '--' encodes a hidden directory '/.'

    Examples:
        '-Users-taehyun-github-foo' → '/Users/taehyun/github/foo'
        '-Users-taehyun--claude' → '/Users/taehyun/.claude'
    """
    if not project_hash:
        return ""

    # Replace '--' with a placeholder first (hidden directory marker)
    result = project_hash.replace("--", "/<DOT>")
    # Replace remaining '-' with '/'
    result = result.replace("-", "/")
    # Restore hidden directory markers
    result = result.replace("/<DOT>", "/.")
    return result


def encode_project_path(project_path: str) -> str:
    """Convert a project path to the Claude Code directory hash format.

    Inverse of decode_project_hash.
    """
    if not project_path:
        return ""
    result = project_path.replace("/.", "--")
    result = result.replace("/", "-")
    return result


def discover_sessions(
    claude_dir: Optional[Path] = None,
    project_filter: Optional[str] = None,
    since: Optional[datetime] = None,
) -> list[dict]:
    """Discover all session JSONL files across all projects.

    Args:
        claude_dir: Path to ~/.claude directory
        project_filter: Only include sessions from projects matching this substring
        since: Only include sessions modified after this datetime

    Returns:
        List of dicts with keys: jsonl_path, session_id, project_hash, project_path
    """
    projects_dir = (claude_dir or CLAUDE_PROJECTS_DIR.parent) / "projects"

    if not projects_dir.exists():
        return []

    sessions = []

    for project_dir in sorted(projects_dir.iterdir()):
        if not project_dir.is_dir():
            continue

        project_hash = project_dir.name
        project_path = decode_project_hash(project_hash)

        # Apply project filter
        if project_filter and project_filter.lower() not in project_path.lower():
            continue

        # Find all JSONL files in this project directory
        for jsonl_file in sorted(project_dir.glob("*.jsonl")):
            session_id = jsonl_file.stem

            # Validate session ID looks like a UUID
            if not re.match(
                r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
                session_id,
            ):
                continue

            # Apply date filter based on file modification time
            if since:
                mtime = datetime.fromtimestamp(jsonl_file.stat().st_mtime)
                if mtime < since:
                    continue

            # Check for subagent directory
            subagent_dir = project_dir / session_id / "subagents"
            subagent_count = 0
            if subagent_dir.exists():
                subagent_count = len(list(subagent_dir.glob("agent-*.jsonl")))

            sessions.append(
                {
                    "jsonl_path": jsonl_file,
                    "session_id": session_id,
                    "project_hash": project_hash,
                    "project_path": project_path,
                    "subagent_dir": subagent_dir if subagent_dir.exists() else None,
                    "subagent_count": subagent_count,
                    "file_size_kb": jsonl_file.stat().st_size / 1024,
                    "modified_at": datetime.fromtimestamp(jsonl_file.stat().st_mtime),
                }
            )

    # Sort by modification time, newest first
    sessions.sort(key=lambda s: s["modified_at"], reverse=True)
    return sessions


def find_session_by_id(
    session_id_prefix: str,
    claude_dir: Optional[Path] = None,
) -> Optional[dict]:
    """Find a session by its ID (or ID prefix).

    Supports partial IDs (e.g., 'e124f83b' matches 'e124f83b-5586-4933-acd0-...').
    """
    all_sessions = discover_sessions(claude_dir=claude_dir)

    matches = [
        s for s in all_sessions if s["session_id"].startswith(session_id_prefix)
    ]

    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        # Return the most recently modified
        return matches[0]
    return None
