"""SQLite storage for historical session metrics."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional

from omas.config import SQLITE_DB_PATH
from omas.models import (
    AutonomyMetrics,
    DensityMetrics,
    ParallelismMetrics,
    SessionMetrics,
    ThreadType,
    TrustMetrics,
)

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS session_metrics (
    session_id TEXT PRIMARY KEY,
    project_path TEXT,
    project_hash TEXT,
    timestamp TEXT,
    model TEXT,
    thread_type TEXT,
    session_duration_minutes REAL,
    total_tool_calls INTEGER,
    total_human_messages INTEGER,

    -- More (Parallelism)
    max_concurrent_agents INTEGER,
    total_sub_agents INTEGER,
    peak_parallel_tools INTEGER,
    p_thread_score REAL,

    -- Longer (Autonomy)
    longest_autonomous_minutes REAL,
    max_tool_calls_between_human INTEGER,
    max_consecutive_assistant_turns INTEGER,
    l_thread_score REAL,

    -- Thicker (Density)
    tool_calls_per_minute REAL,
    max_sub_agent_depth INTEGER,
    tokens_per_minute REAL,
    b_thread_score REAL,
    ai_written_lines INTEGER,
    ai_line_bonus REAL,

    -- Fewer (Trust)
    tool_calls_per_human REAL,
    assistant_per_human_ratio REAL,
    ask_user_count INTEGER,
    autonomous_tool_call_pct REAL,
    z_thread_score REAL,

    -- Tool breakdown (JSON text: {"Read": 45, "Bash": 30, ...})
    tool_breakdown TEXT,

    -- Composite
    overall_score REAL,
    analyzed_at TEXT
)
"""


class MetricsStore:
    """SQLite-backed store for session metrics."""

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or SQLITE_DB_PATH
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(CREATE_TABLE_SQL)
            # Migration: add columns to existing databases
            self._migrate_add_column(conn, "tool_breakdown", "TEXT")
            self._migrate_add_column(conn, "ai_written_lines", "INTEGER")
            self._migrate_add_column(conn, "ai_line_bonus", "REAL")

    @staticmethod
    def _migrate_add_column(conn, column_name: str, column_type: str):
        """Add a column to session_metrics if it doesn't already exist."""
        try:
            conn.execute(
                f"ALTER TABLE session_metrics ADD COLUMN {column_name} {column_type}"
            )
        except sqlite3.OperationalError:
            pass  # Column already exists

    def save_metrics(self, metrics: SessionMetrics):
        """Save or update session metrics."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO session_metrics (
                    session_id, project_path, project_hash, timestamp, model,
                    thread_type, session_duration_minutes, total_tool_calls,
                    total_human_messages,
                    max_concurrent_agents, total_sub_agents,
                    peak_parallel_tools, p_thread_score,
                    longest_autonomous_minutes, max_tool_calls_between_human,
                    max_consecutive_assistant_turns, l_thread_score,
                    tool_calls_per_minute, max_sub_agent_depth,
                    tokens_per_minute, b_thread_score,
                    ai_written_lines, ai_line_bonus,
                    tool_calls_per_human, assistant_per_human_ratio,
                    ask_user_count, autonomous_tool_call_pct, z_thread_score,
                    tool_breakdown,
                    overall_score, analyzed_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?,
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?,
                    ?, ?
                )
                """,
                (
                    metrics.session_id,
                    metrics.project_path,
                    metrics.project_hash,
                    metrics.timestamp.isoformat() if metrics.timestamp else None,
                    metrics.model,
                    metrics.thread_type.value,
                    metrics.session_duration_minutes,
                    metrics.total_tool_calls,
                    metrics.total_human_messages,
                    # Parallelism
                    metrics.parallelism.max_concurrent_agents,
                    metrics.parallelism.total_sub_agents,
                    metrics.parallelism.peak_parallel_tools,
                    metrics.parallelism.p_thread_score,
                    # Autonomy
                    metrics.autonomy.longest_autonomous_stretch_minutes,
                    metrics.autonomy.max_tool_calls_between_human,
                    metrics.autonomy.max_consecutive_assistant_turns,
                    metrics.autonomy.l_thread_score,
                    # Density
                    metrics.density.tool_calls_per_minute,
                    metrics.density.max_sub_agent_depth,
                    metrics.density.tokens_per_minute,
                    metrics.density.b_thread_score,
                    metrics.density.ai_written_lines,
                    metrics.density.ai_line_bonus,
                    # Trust
                    metrics.trust.tool_calls_per_human_message,
                    metrics.trust.assistant_per_human_ratio,
                    metrics.trust.ask_user_count,
                    metrics.trust.autonomous_tool_call_pct,
                    metrics.trust.z_thread_score,
                    # Tool breakdown (JSON)
                    json.dumps(metrics.tool_breakdown) if metrics.tool_breakdown else None,
                    # Composite
                    metrics.overall_score,
                    datetime.now().isoformat(),
                ),
            )

    def load_all(
        self,
        project_filter: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
    ) -> list[SessionMetrics]:
        """Load all stored session metrics with optional filters."""
        query = "SELECT * FROM session_metrics WHERE 1=1"
        params: list = []

        if project_filter:
            query += " AND project_path LIKE ?"
            params.append(f"%{project_filter}%")

        if since:
            query += " AND timestamp >= ?"
            params.append(since.isoformat())

        if until:
            query += " AND timestamp <= ?"
            params.append(until.isoformat())

        query += " ORDER BY timestamp DESC"

        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(query, params).fetchall()

        return [_row_to_metrics(row) for row in rows]

    def get_session(self, session_id: str) -> Optional[SessionMetrics]:
        """Load a single session's metrics."""
        with sqlite3.connect(self.db_path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM session_metrics WHERE session_id = ?",
                (session_id,),
            ).fetchone()

        if row:
            return _row_to_metrics(row)
        return None

    def count(self) -> int:
        """Count total stored sessions."""
        with sqlite3.connect(self.db_path) as conn:
            result = conn.execute("SELECT COUNT(*) FROM session_metrics").fetchone()
            return result[0] if result else 0


def _safe_row_get(row: sqlite3.Row, key: str, default=None):
    """Safely get a value from a Row, returning default if column doesn't exist."""
    try:
        val = row[key]
        return val if val is not None else default
    except (IndexError, KeyError):
        return default


def _row_to_metrics(row: sqlite3.Row) -> SessionMetrics:
    """Convert a SQLite row to SessionMetrics."""
    return SessionMetrics(
        session_id=row["session_id"],
        project_path=row["project_path"] or "",
        project_hash=row["project_hash"] or "",
        timestamp=_parse_row_timestamp(row["timestamp"]),
        model=row["model"] or "unknown",
        thread_type=_parse_thread_type(row["thread_type"]),
        session_duration_minutes=row["session_duration_minutes"] or 0.0,
        total_tool_calls=row["total_tool_calls"] or 0,
        total_human_messages=row["total_human_messages"] or 0,
        parallelism=_build_parallelism(row),
        autonomy=_build_autonomy(row),
        density=_build_density(row),
        trust=_build_trust(row),
        tool_breakdown=_parse_tool_breakdown(row),
        ai_written_lines=_safe_row_get(row, "ai_written_lines") or 0,
        overall_score=row["overall_score"] or 0.0,
    )


def _parse_row_timestamp(ts_str: Optional[str]) -> Optional[datetime]:
    """Parse an ISO timestamp string from a DB row."""
    if not ts_str:
        return None
    try:
        from dateutil.parser import isoparse
        return isoparse(ts_str)
    except (ValueError, TypeError):
        return None


def _parse_tool_breakdown(row: sqlite3.Row) -> dict[str, int]:
    """Parse JSON tool_breakdown from a DB row, with graceful fallback."""
    try:
        raw = row["tool_breakdown"]
        if raw:
            return json.loads(raw)
    except (IndexError, KeyError, json.JSONDecodeError):
        pass
    return {}


def _parse_thread_type(value: Optional[str]) -> ThreadType:
    """Parse thread type with fallback to BASE."""
    return ThreadType(value) if value else ThreadType.BASE


def _build_parallelism(row: sqlite3.Row) -> ParallelismMetrics:
    return ParallelismMetrics(
        max_concurrent_agents=row["max_concurrent_agents"] or 0,
        total_sub_agents=row["total_sub_agents"] or 0,
        peak_parallel_tools=row["peak_parallel_tools"] or 0,
        p_thread_score=row["p_thread_score"] or 0.0,
    )


def _build_autonomy(row: sqlite3.Row) -> AutonomyMetrics:
    return AutonomyMetrics(
        longest_autonomous_stretch_minutes=row["longest_autonomous_minutes"] or 0.0,
        max_tool_calls_between_human=row["max_tool_calls_between_human"] or 0,
        max_consecutive_assistant_turns=row["max_consecutive_assistant_turns"] or 0,
        l_thread_score=row["l_thread_score"] or 0.0,
        session_duration_minutes=row["session_duration_minutes"] or 0.0,
    )


def _build_density(row: sqlite3.Row) -> DensityMetrics:
    return DensityMetrics(
        tool_calls_per_minute=row["tool_calls_per_minute"] or 0.0,
        max_sub_agent_depth=row["max_sub_agent_depth"] or 0,
        total_tool_calls=row["total_tool_calls"] or 0,
        tokens_per_minute=row["tokens_per_minute"] or 0.0,
        b_thread_score=row["b_thread_score"] or 0.0,
        ai_written_lines=_safe_row_get(row, "ai_written_lines") or 0,
        ai_line_bonus=_safe_row_get(row, "ai_line_bonus") or 0.0,
    )


def _build_trust(row: sqlite3.Row) -> TrustMetrics:
    return TrustMetrics(
        tool_calls_per_human_message=row["tool_calls_per_human"] or 0.0,
        assistant_per_human_ratio=row["assistant_per_human_ratio"] or 0.0,
        ask_user_count=row["ask_user_count"] or 0,
        autonomous_tool_call_pct=row["autonomous_tool_call_pct"] or 0.0,
        z_thread_score=row["z_thread_score"] or 0.0,
    )
