"""Minimum qualifying thresholds and session weighting for fair comparison."""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from omas.models import SessionMetrics

# Minimum thresholds: sessions below these are excluded from comparison
MINIMUM_THRESHOLDS = {
    "session_duration_minutes": 5,   # At least 5 minutes
    "total_tool_calls": 10,          # At least 10 tool calls
    "total_human_messages": 1,       # At least 1 human message (no pure automation scripts)
}


def is_qualified(session: SessionMetrics) -> bool:
    """Check if a session meets minimum qualifying thresholds.

    Sessions below these thresholds are excluded from aggregate score
    calculations to ensure fair comparison.
    """
    if session.session_duration_minutes < MINIMUM_THRESHOLDS["session_duration_minutes"]:
        return False
    if session.total_tool_calls < MINIMUM_THRESHOLDS["total_tool_calls"]:
        return False
    if session.total_human_messages < MINIMUM_THRESHOLDS["total_human_messages"]:
        return False
    return True


def session_weight(session: SessionMetrics) -> float:
    """Compute weight for a session in aggregated scoring.

    Longer sessions with more tool calls get proportionally more weight,
    using log scaling to prevent extreme outliers from dominating.
    """
    return math.log1p(session.total_tool_calls) * math.log1p(session.session_duration_minutes)


def consistency_score(sessions: list[SessionMetrics], n: int = 20) -> float:
    """Compute consistency score from recent sessions (0-10 scale).

    Lower standard deviation in overall scores = higher consistency.
    A perfectly consistent performer scores 10.0.
    """
    recent = sessions[:n]
    if len(recent) < 2:
        return 5.0  # Not enough data for meaningful consistency

    scores = [s.overall_score for s in recent]
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / len(scores)
    std_dev = math.sqrt(variance)

    # Map std_dev to 0-10 scale (lower deviation = higher score)
    # std_dev of 0 → 10, std_dev of 3+ → ~0
    return max(0.0, min(10.0, 10.0 - std_dev * 3.33))
