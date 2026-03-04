"""Discover Claude Code session JSONL files."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Optional

from omas.config import CLAUDE_PROJECTS_DIR


def decode_project_hash(project_hash: str) -> str:
    """Convert a project directory hash to a human-readable path.

    Claude Code encodes project paths by replacing '/' with '-' and '/.' with '--'.
    The challenge is that directory names themselves can contain hyphens
    (e.g., 'measure-ai-thread-capability'), so naive replacement breaks them.

    Strategy:
        1. Handle '--' (hidden dirs like '.claude') first
        2. Split remaining segments by '-'
        3. Greedily reconstruct by checking filesystem existence at each step
        4. Fall back to naive decode if path doesn't exist on this machine

    Examples:
        '-Users-john-github-foo' → '/Users/john/github/foo'
        '-Users-john--claude' → '/Users/john/.claude'
        '-Users-john-github-my-project' → '/Users/john/github/my-project'
    """
    if not project_hash:
        return ""

    # Try filesystem-aware decode first
    resolved = _decode_with_filesystem(project_hash)
    if resolved:
        return resolved

    # Fallback: naive decode (for paths not on this machine)
    result = project_hash.replace("--", "/<DOT>")
    result = result.replace("-", "/")
    result = result.replace("/<DOT>", "/.")
    return result


# Cache to avoid repeated filesystem lookups during a single scan
_decode_cache: dict[str, str] = {}


def _decode_with_filesystem(project_hash: str) -> str | None:
    """Decode project hash by greedily checking filesystem existence.

    Splits the hash into segments and tries to join them with hyphens,
    checking at each step whether the resulting directory exists.

    Returns the resolved path, or None if it cannot be determined.
    """
    if project_hash in _decode_cache:
        return _decode_cache[project_hash]

    # Step 1: Handle '--' (hidden directory marker '/.') by replacing with a
    # unique placeholder that won't collide with normal segments
    normalized = project_hash.replace("--", "-\x00DOT\x00")

    # Step 2: Split by '-' (first element is empty because hash starts with '-')
    parts = normalized.split("-")
    if parts and parts[0] == "":
        parts = parts[1:]

    if not parts:
        return None

    # Step 3: Restore hidden dir markers
    restored_parts = []
    for p in parts:
        if p == "\x00DOT\x00":
            # This segment was a hidden dir prefix — merge with next as '.'
            if restored_parts:
                restored_parts[-1] = restored_parts[-1] + "/."
            else:
                restored_parts.append(".")
        else:
            restored_parts.append(p)

    # Step 4: Greedy filesystem-based reconstruction
    current_path = Path("/")
    result_segments: list[str] = []
    buffer = ""

    for i, part in enumerate(restored_parts):
        if buffer:
            candidate = f"{buffer}-{part}"
        else:
            candidate = part

        candidate_path = current_path / candidate
        remaining = restored_parts[i + 1:]

        if candidate_path.exists():
            # This segment exists — commit it
            result_segments.append(candidate)
            current_path = candidate_path
            buffer = ""
        elif remaining:
            # Doesn't exist yet — buffer and try combining with next segment
            buffer = candidate
        else:
            # Last segment — commit whatever we have
            result_segments.append(candidate)
            buffer = ""

    if buffer:
        result_segments.append(buffer)

    resolved = "/" + "/".join(result_segments)

    # Validate: only cache if the full path exists
    if Path(resolved).exists():
        _decode_cache[project_hash] = resolved
        return resolved

    # If full path doesn't exist, clear cache entry and return None
    return None


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
