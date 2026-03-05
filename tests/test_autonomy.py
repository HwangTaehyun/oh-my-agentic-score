"""Tests for autonomy metrics (Bug #6 fix)."""
import pytest
from datetime import datetime, timedelta
from omas.models import SessionData, ToolCall, UserMessage, IDLE_GAP_THRESHOLD
from omas.metrics.autonomy import compute_autonomy


def _make_session(
    human_times: list[datetime],
    tool_times: list[datetime],
    start: datetime = None,
    end: datetime = None,
) -> SessionData:
    data = SessionData(session_id="test")
    data.user_messages = [
        UserMessage(timestamp=t, is_human=True, content_preview="test") for t in human_times
    ]
    for t in tool_times:
        data.tool_calls.append(ToolCall(name="Bash", tool_use_id="x", timestamp=t))
    data.assistant_message_count = len(tool_times)
    if start:
        data.start_time = start
    elif tool_times or human_times:
        all_times = human_times + tool_times
        data.start_time = min(all_times)
    if end:
        data.end_time = end
    elif tool_times or human_times:
        all_times = human_times + tool_times
        data.end_time = max(all_times)
    return data


class TestAutonomyStretch:
    def test_fully_autonomous_no_idle(self):
        """Continuous tool calls = full stretch counted."""
        t0 = datetime(2026, 1, 1, 10, 0)
        tools = [t0 + timedelta(minutes=i) for i in range(60)]
        data = _make_session([], tools)
        result = compute_autonomy(data)
        assert result.longest_autonomous_stretch_minutes >= 55  # ~59 min

    def test_fully_autonomous_with_idle_gap(self):
        """Large idle gap in middle should be capped, not counted fully."""
        t0 = datetime(2026, 1, 1, 10, 0)
        # 10 min of work, then 5 hour gap, then 10 min of work
        tools = (
            [t0 + timedelta(minutes=i) for i in range(10)]
            + [t0 + timedelta(hours=5, minutes=i) for i in range(10)]
        )
        data = _make_session([], tools)
        result = compute_autonomy(data)
        # Should NOT be 310 minutes (5h 10m). Should be ~49 min (10 + 30 cap + 9)
        assert result.longest_autonomous_stretch_minutes < 60

    def test_interleaved_active_stretch(self):
        """Active stretch between human messages should exclude idle."""
        t0 = datetime(2026, 1, 1, 10, 0)
        humans = [t0, t0 + timedelta(hours=6)]
        # Tools: 10 min work, then 5 hour gap, then 10 min work
        tools = (
            [t0 + timedelta(minutes=i + 1) for i in range(10)]
            + [t0 + timedelta(hours=5, minutes=i) for i in range(10)]
        )
        data = _make_session(humans, tools)
        result = compute_autonomy(data)
        assert result.longest_autonomous_stretch_minutes < 60

    def test_no_tool_calls(self):
        """No tool calls = 0 stretch."""
        t0 = datetime(2026, 1, 1, 10, 0)
        data = _make_session([t0], [])
        result = compute_autonomy(data)
        assert result.longest_autonomous_stretch_minutes == 0.0

    def test_single_tool_call(self):
        """Single tool call = 0 stretch."""
        t0 = datetime(2026, 1, 1, 10, 0)
        data = _make_session([], [t0])
        result = compute_autonomy(data)
        assert result.longest_autonomous_stretch_minutes == 0.0

    def test_l_score_capped_at_10(self):
        """L-score should never exceed 10."""
        t0 = datetime(2026, 1, 1, 10, 0)
        # 4 hours of continuous work
        tools = [t0 + timedelta(minutes=i) for i in range(240)]
        data = _make_session([], tools)
        result = compute_autonomy(data)
        assert result.l_thread_score <= 10.0
