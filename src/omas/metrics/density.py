"""'Thicker' dimension - Density metrics (B-threads)."""

from __future__ import annotations

from omas.config import AI_LINES_FULL_SCORE
from omas.models import DensityMetrics, SessionData

# Team orchestration tool categories for spam filtering
TEAM_ACTION_TOOLS = {"TeamCreate", "TaskCreate", "TaskUpdate", "SendMessage"}
TEAM_QUERY_TOOLS = {"TaskGet", "TaskList"}

# Scoring parameters
_DEPTH_COEFF = 0.2
_QUERY_WEIGHT = 0.1
_TEAM_BONUS_CAP = 2.0


def compute_density(
    data: SessionData,
    max_concurrent_agents: int = 0,
) -> DensityMetrics:
    """Compute work density metrics for a session.

    v2.0: Multi-factor scoring with anti-spam filtering.
    Score = min(base * depth_mult + team_bonus, 10.0)
      - base = min(total_agents, 10)
      - depth_mult = 1.0 + (max_depth - 1) * 0.2  (if depth >= 2)
      - team_bonus = min(effective_team_score / 10, 2.0)
      - effective_team_score = action_calls + query_calls * 0.1

    Args:
        data: Parsed session data.
        max_concurrent_agents: Peak within-session agent concurrency
            (kept for metrics tracking but no longer affects score).
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

    # --- v2.0 Multi-factor scoring ---

    # Base score: agent count, capped at 10
    total_agents = len(data.sub_agents)
    base = min(float(total_agents), 10.0)

    # Spam-filtered team tool calls
    action_calls = sum(1 for tc in data.tool_calls if tc.name in TEAM_ACTION_TOOLS)
    query_calls = sum(1 for tc in data.tool_calls if tc.name in TEAM_QUERY_TOOLS)
    effective_team_score = action_calls + query_calls * _QUERY_WEIGHT

    # Depth multiplier: reward deeper orchestration
    depth_mult = 1.0
    if max_depth >= 2:
        depth_mult = 1.0 + (max_depth - 1) * _DEPTH_COEFF

    # Anti-gaming: team bonus only when actual agents exist
    if total_agents > 0:
        team_bonus = min(effective_team_score / 10.0, _TEAM_BONUS_CAP)
    else:
        team_bonus = 0.0

    # Final score
    b_score = min(base * depth_mult + team_bonus, 10.0)

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
        team_action_calls=action_calls,
        team_query_calls=query_calls,
        effective_team_score=round(effective_team_score, 2),
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
