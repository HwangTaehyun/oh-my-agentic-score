"""'Longer' dimension - Autonomy metrics (L-threads).

Measures how long Claude runs without human intervention.

Composite l_thread_score (0-10 scale, log normalized):
  0 min → 0,  1 min → 1.4,  5 min → 3.6,  10 min → 4.8,
  20 min → 6.1,  30 min → 6.9,  60 min → 8.2,  120 min → 9.6,
  200+ min → ~10.0
"""

from __future__ import annotations

import math
from datetime import datetime

from omas.models import IDLE_GAP_THRESHOLD, AutonomyMetrics, SessionData


def compute_autonomy(data: SessionData) -> AutonomyMetrics:
    """Compute autonomy metrics for a session.

    Measures how long Claude actually worked without human intervention.
    We measure from a human message to Claude's LAST activity before the
    next human message, avoiding inflation from idle time.
    """
    human_msgs = sorted(data.human_messages, key=lambda m: m.timestamp)
    tool_calls = sorted(data.tool_calls, key=lambda t: t.timestamp)
    activity_timestamps = sorted([tc.timestamp for tc in data.tool_calls])

    if not human_msgs:
        longest_stretch, max_tools_between = _fully_autonomous_stretch(
            data, activity_timestamps, tool_calls
        )
    else:
        longest_stretch, max_tools_between = _human_interleaved_stretch(
            data, human_msgs, tool_calls, activity_timestamps
        )

    max_consecutive = _count_max_consecutive_assistant_turns(data)
    l_score = min(math.log1p(longest_stretch) * 2.0, 10.0)

    return AutonomyMetrics(
        longest_autonomous_stretch_minutes=round(longest_stretch, 2),
        max_tool_calls_between_human=max_tools_between,
        session_duration_minutes=round(data.duration_minutes, 2),
        max_consecutive_assistant_turns=max_consecutive,
        l_thread_score=round(l_score, 2),
    )


def _active_duration_minutes(timestamps: list[datetime]) -> float:
    """Sum active time between consecutive timestamps, capping idle gaps."""
    if len(timestamps) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(timestamps)):
        gap = timestamps[i] - timestamps[i - 1]
        if gap <= IDLE_GAP_THRESHOLD:
            total += gap.total_seconds()
        else:
            total += IDLE_GAP_THRESHOLD.total_seconds()
    return total / 60.0


def _fully_autonomous_stretch(data, activity_timestamps, tool_calls):
    """Compute stretch when there are no human messages (fully autonomous)."""
    if len(activity_timestamps) >= 2:
        stretch = _active_duration_minutes(activity_timestamps)
    elif data.duration_minutes > 0:
        stretch = data.duration_minutes
    else:
        stretch = 0.0
    return stretch, len(tool_calls)


def _human_interleaved_stretch(data, human_msgs, tool_calls, activity_timestamps):
    """Compute stretch when human messages interleave with Claude activity."""
    longest = 0.0
    max_tools = 0

    # Segment before first human message
    if data.start_time:
        before = [ts for ts in activity_timestamps if ts < human_msgs[0].timestamp]
        if before:
            gap = _active_duration_minutes([data.start_time] + before)
            longest = max(longest, gap)
            max_tools = max(max_tools, len(before))

    # Segments between consecutive human messages
    for i in range(len(human_msgs) - 1):
        start, end = human_msgs[i].timestamp, human_msgs[i + 1].timestamp
        calls = [t for t in tool_calls if start < t.timestamp < end]
        acts = [ts for ts in activity_timestamps if start < ts < end]
        if acts:
            longest = max(longest, _active_duration_minutes([start] + acts))
        max_tools = max(max_tools, len(calls))

    # Segment after last human message
    last = human_msgs[-1].timestamp
    after_acts = [ts for ts in activity_timestamps if ts > last]
    after_calls = [t for t in tool_calls if t.timestamp > last]
    if after_acts:
        longest = max(longest, _active_duration_minutes([last] + after_acts))
    max_tools = max(max_tools, len(after_calls))

    return longest, max_tools


def _count_max_consecutive_assistant_turns(data: SessionData) -> int:
    """Count the longest run of assistant messages without human intervention."""
    # Build a timeline of message types
    events = []
    for msg in data.user_messages:
        events.append(("human" if msg.is_human else "tool_result", msg.timestamp))

    # We only care about alternation between human and assistant
    # Use tool_calls as proxy for assistant activity between human messages
    human_timestamps = sorted([m.timestamp for m in data.human_messages])

    if not human_timestamps:
        return data.assistant_message_count

    # Count assistant messages between each pair of human messages
    # This is a simplified approach: just count total assistant / max(1, human)
    if len(human_timestamps) <= 1:
        return data.assistant_message_count

    return max(1, data.assistant_message_count // len(human_timestamps))
