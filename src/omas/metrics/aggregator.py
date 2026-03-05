"""Aggregate all 4 dimensions into SessionMetrics."""

from __future__ import annotations

from collections import Counter

from omas.classifier.thread_classifier import classify_thread
from omas.metrics.autonomy import compute_autonomy
from omas.metrics.density import compute_density
from omas.metrics.parallelism import compute_parallelism
from omas.metrics.trust import compute_trust
from omas.models import SessionData, SessionMetrics


def compute_session_metrics(
    data: SessionData,
    project_path: str = "",
    project_hash: str = "",
    concurrent_sessions: int = 1,
) -> SessionMetrics:
    """Compute all metrics for a session and classify its thread type.

    This is the main entry point for analysis.

    Args:
        data: Parsed session data.
        project_path: Override project path (uses data.project_path if empty).
        project_hash: Override project hash (uses data.project_hash if empty).
        concurrent_sessions: Number of sessions running concurrently
            (from cross-session overlap analysis, passed to P-thread).
    """
    parallelism = compute_parallelism(data, concurrent_sessions)
    autonomy = compute_autonomy(data)
    density = compute_density(
        data, max_concurrent_agents=parallelism.max_concurrent_agents
    )
    trust = compute_trust(data)

    # Classify thread type
    thread_type = classify_thread(data, parallelism, autonomy, density, trust)

    # Compute overall score (weighted average of normalized dimension scores)
    overall = _compute_overall_score(parallelism, autonomy, density, trust)

    # Build per-tool-name usage breakdown
    tool_breakdown = _compute_tool_breakdown(data)

    return SessionMetrics(
        session_id=data.session_id,
        project_path=project_path or data.project_path,
        project_hash=project_hash or data.project_hash,
        timestamp=data.start_time,
        model=data.model,
        thread_type=thread_type,
        session_duration_minutes=round(data.duration_minutes, 2),
        total_tool_calls=len(data.tool_calls),
        total_human_messages=len(data.human_messages),
        parallelism=parallelism,
        autonomy=autonomy,
        density=density,
        trust=trust,
        tool_breakdown=tool_breakdown,
        ai_written_lines=data.ai_written_lines,
        overall_score=overall,
    )


def _compute_overall_score(
    parallelism,
    autonomy,
    density,
    trust,
) -> float:
    """Compute a composite score from all dimensions.

    Uses log-scale normalization for metrics with unbounded ranges.
    Each dimension contributes equally (25% weight).

    All four dimension scores are already on a 0-10 scale:
    - p_thread_score: parallelism (capped at 10)
    - l_thread_score: autonomy (log-scaled)
    - b_thread_score: density (log-scaled)
    - z_thread_score: trust (log-scaled with AskUser penalty)
    """
    p_norm = min(parallelism.p_thread_score, 10.0)
    l_norm = min(autonomy.l_thread_score, 10.0)
    b_norm = min(density.b_thread_score + density.ai_line_bonus, 10.0)
    f_norm = min(trust.z_thread_score, 10.0)

    overall = (p_norm + l_norm + b_norm + f_norm) / 4.0
    return round(overall, 2)


def _compute_tool_breakdown(data: SessionData) -> dict[str, int]:
    """Count tool calls by tool name, sorted by frequency descending.

    Returns a dict like {"Read": 45, "Bash": 30, "Edit": 12, "Skill": 3, ...}.
    """
    counts = Counter(tc.name for tc in data.tool_calls)
    # Sort by count descending, then alphabetically for ties
    return dict(sorted(counts.items(), key=lambda x: (-x[1], x[0])))
