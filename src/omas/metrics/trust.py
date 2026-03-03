"""'Fewer' dimension - Trust/autonomy metrics.

Measures how few human checkpoints Claude needs to do substantial work.
Higher score = fewer human interventions per unit of work = higher trust.

Composite z_thread_score (0-10 scale):
- Primary: log1p(tool_calls_per_human_message) * 2.0 — higher means more
  autonomous work per human interaction. 50 tools/human ≈ 7.9, 150+ ≈ 10.
- Penalty: AskUserQuestion usage reduces score (shows uncertainty),
  BUT AskUserQuestion calls during plan mode are EXCLUDED from penalty.
  Asking clarifying questions during planning is good practice — it leads
  to better autonomous execution later.
"""

from __future__ import annotations

import math
from datetime import datetime

from omas.models import SessionData, TrustMetrics


def _build_plan_mode_windows(
    tool_calls: list,
) -> list[tuple[datetime, datetime]]:
    """Build time windows where Claude is in plan mode.

    Detects EnterPlanMode → ExitPlanMode pairs from tool call timeline.
    If EnterPlanMode is not closed by ExitPlanMode, the window extends
    to the last tool call in the session (plan mode was active until end).

    Returns list of (start, end) datetime tuples.
    """
    windows: list[tuple[datetime, datetime]] = []
    enter_ts: datetime | None = None

    for tc in sorted(tool_calls, key=lambda t: t.timestamp):
        if tc.name == "EnterPlanMode":
            enter_ts = tc.timestamp
        elif tc.name == "ExitPlanMode" and enter_ts is not None:
            windows.append((enter_ts, tc.timestamp))
            enter_ts = None

    # If plan mode was entered but never exited, extend to last tool call
    if enter_ts is not None and tool_calls:
        last_ts = max(tc.timestamp for tc in tool_calls)
        windows.append((enter_ts, last_ts))

    return windows


def _is_in_plan_mode(
    timestamp: datetime,
    plan_windows: list[tuple[datetime, datetime]],
) -> bool:
    """Check if a given timestamp falls within any plan mode window."""
    for start, end in plan_windows:
        if start <= timestamp <= end:
            return True
    return False


def compute_trust(data: SessionData) -> TrustMetrics:
    """Compute trust metrics for a session.

    Measures how few human checkpoints were needed.

    AskUserQuestion calls during plan mode (between EnterPlanMode and
    ExitPlanMode) are NOT penalized — asking clarifying questions during
    planning is a positive signal that leads to better autonomous execution.
    Only AskUserQuestion calls outside plan mode are penalized.
    """
    human_count = len(data.human_messages)
    total_calls = len(data.tool_calls)
    assistant_count = data.assistant_message_count

    # Tool calls per human message
    calls_per_human = total_calls / max(human_count, 1)

    # Assistant to human ratio
    asst_per_human = assistant_count / max(human_count, 1)

    # Build plan mode time windows
    plan_windows = _build_plan_mode_windows(data.tool_calls)

    # Count AskUserQuestion tool calls, split by plan mode context
    total_ask_user = 0
    plan_mode_ask_user = 0
    penalized_ask_user = 0

    for tc in data.tool_calls:
        if tc.name in ("AskUserQuestion", "ask_user"):
            total_ask_user += 1
            if _is_in_plan_mode(tc.timestamp, plan_windows):
                plan_mode_ask_user += 1
            else:
                penalized_ask_user += 1

    # Autonomous tool call percentage (excludes only penalized AskUser)
    if total_calls > 0:
        autonomous_pct = (1.0 - (penalized_ask_user / total_calls)) * 100.0
    else:
        autonomous_pct = 100.0

    # Composite trust score (0-10 scale)
    # Primary factor: how many tool calls per human intervention (log scale)
    #   1 tool/human → 1.4,  5 → 3.6,  10 → 4.8,
    #   20 → 6.1,  50 → 7.9,  100 → 9.2,  150+ → ~10.0
    ratio_score = min(math.log1p(calls_per_human) * 2.0, 10.0)

    # Penalty: Only AskUserQuestion OUTSIDE plan mode reduces trust
    # Plan mode AskUser is excluded — it's good planning practice
    if total_calls > 0 and penalized_ask_user > 0:
        ask_ratio = penalized_ask_user / total_calls
        ask_penalty = min(ask_ratio * 10.0, 3.0)  # up to 3pt penalty
    else:
        ask_penalty = 0.0

    z_score = max(ratio_score - ask_penalty, 0.0)

    return TrustMetrics(
        tool_calls_per_human_message=round(calls_per_human, 2),
        assistant_per_human_ratio=round(asst_per_human, 2),
        ask_user_count=total_ask_user,
        plan_mode_ask_user_count=plan_mode_ask_user,
        penalized_ask_user_count=penalized_ask_user,
        autonomous_tool_call_pct=round(autonomous_pct, 2),
        z_thread_score=round(z_score, 2),
    )
