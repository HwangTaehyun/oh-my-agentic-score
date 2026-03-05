"""'Thicker' dimension - Density metrics (B-threads)."""

from __future__ import annotations

import math

from omas.config import AI_LINES_FULL_SCORE
from omas.models import DensityMetrics, SessionData


def compute_density(
    data: SessionData,
    max_concurrent_agents: int = 0,
) -> DensityMetrics:
    """Compute work density metrics for a session.

    Measures how much work is done per unit time.
    Orchestration breadth (from within-session agent concurrency) is now
    folded into the B-thread score here, since P-thread was redesigned
    for cross-session concurrency.

    Args:
        data: Parsed session data.
        max_concurrent_agents: Peak within-session agent concurrency
            (moved from P-thread to contribute to B-thread density).
    """
    duration = data.duration_minutes
    total_calls = len(data.tool_calls)

    # Tool calls per minute
    calls_per_min = total_calls / max(duration, 0.1)

    # Tokens per minute
    total_tokens = data.total_usage.total_tokens
    tokens_per_min = total_tokens / max(duration, 0.1)

    # Max sub-agent depth
    max_depth = _compute_max_depth(data)

    # B-thread score: log-normalized to keep within 0-10 scale
    # Orchestration breadth adds credit for within-session agent concurrency
    total_sub = len(data.sub_agents)
    orchestration = max(0, max_concurrent_agents - 1)
    raw = total_sub * max(1, max_depth) + orchestration
    b_score = min(math.log1p(raw) * 3.0, 10.0)

    # AI-written lines bonus: linear, max +1.0 at AI_LINES_FULL_SCORE lines
    ai_lines = data.ai_written_lines
    line_bonus = min(ai_lines / AI_LINES_FULL_SCORE, 1.0)

    return DensityMetrics(
        tool_calls_per_minute=round(calls_per_min, 2),
        max_sub_agent_depth=max_depth,
        total_tool_calls=total_calls,
        tokens_per_minute=round(tokens_per_min, 2),
        b_thread_score=round(b_score, 2),
        ai_written_lines=ai_lines,
        ai_line_bonus=round(line_bonus, 4),
    )


def _compute_max_depth(data: SessionData) -> int:
    """Compute the maximum nesting depth of sub-agents.

    Depth 0 = no sub-agents
    Depth 1 = has sub-agents but they don't spawn their own
    Depth 2+ = sub-agents that spawn sub-agents (B-thread)
    """
    if not data.sub_agents:
        return 0

    has_nested = any(sa.has_nested_agents for sa in data.sub_agents)
    if has_nested:
        return 2  # At minimum depth 2; deeper nesting detection would require recursive parsing

    return 1
