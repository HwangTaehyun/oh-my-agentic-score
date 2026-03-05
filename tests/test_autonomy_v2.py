"""Tests for Longer v2.0 (P75 + Consistency) autonomy scoring."""

import math
import pytest
from datetime import datetime, timedelta

from omas.models import SessionData, ToolCall, UserMessage


def _make_autonomy_session(stretches: list[float]) -> SessionData:
    """Create a SessionData whose autonomous stretches match the given durations (minutes).

    Each stretch becomes a segment between two consecutive human messages,
    filled with tool calls spaced 1 minute apart to produce the desired duration.
    """
    data = SessionData(session_id="test-v2")

    if not stretches:
        # Empty session with a single human message and no tools
        t0 = datetime(2026, 1, 1, 10, 0)
        data.user_messages = [
            UserMessage(timestamp=t0, is_human=True, content_preview="hi")
        ]
        data.start_time = t0
        data.end_time = t0
        data.assistant_message_count = 0
        return data

    t = datetime(2026, 1, 1, 10, 0)
    all_tool_calls: list[ToolCall] = []
    human_messages: list[UserMessage] = []
    assistant_count = 0

    for stretch_minutes in stretches:
        # Human message marks the start of a new stretch
        human_messages.append(
            UserMessage(timestamp=t, is_human=True, content_preview="go")
        )
        # Create tool calls spanning the stretch duration
        # Use 1-minute intervals; need at least 2 timestamps to measure duration
        n_tools = max(2, int(stretch_minutes) + 1)
        step = stretch_minutes / (n_tools - 1) if n_tools > 1 else 0
        for i in range(n_tools):
            tc_time = t + timedelta(minutes=step * i + 0.01)  # tiny offset after human msg
            all_tool_calls.append(
                ToolCall(name="Bash", tool_use_id=f"tc-{len(all_tool_calls)}", timestamp=tc_time)
            )
        assistant_count += n_tools

        # Move time cursor past this stretch with a gap
        t = t + timedelta(minutes=stretch_minutes + 5)

    data.user_messages = human_messages
    data.tool_calls = all_tool_calls
    data.assistant_message_count = assistant_count
    data.start_time = human_messages[0].timestamp
    data.end_time = all_tool_calls[-1].timestamp
    return data


def _expected_score(p75: float) -> float:
    """Compute expected v2.1 l_thread_score (CV removed)."""
    return round(min(math.log1p(p75) * 2.5, 10.0), 2)


class TestConsistentStretches:
    """Test consistent stretches [10,10,10,10,10,10]."""

    def test_consistent_stretches(self):
        data = _make_autonomy_session([10, 10, 10, 10, 10, 10])
        from omas.metrics.autonomy import compute_autonomy

        result = compute_autonomy(data)

        # v2.1: P75 = 10, consistency always 1.0
        assert result.p75_autonomous_stretch_minutes == pytest.approx(10.0, abs=1.0)
        assert result.consistency_factor == 1.0
        assert result.l_thread_score == pytest.approx(5.99, abs=0.1)


class TestIrregularStretches:
    """Test irregular stretches [60,1,1,1,1,1,1,1,1,1,1]."""

    def test_irregular_stretches(self):
        data = _make_autonomy_session([60, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
        from omas.metrics.autonomy import compute_autonomy

        result = compute_autonomy(data)

        # v2.1: P75 = 1, consistency always 1.0
        assert result.p75_autonomous_stretch_minutes == pytest.approx(1.0, abs=1.0)
        assert result.consistency_factor == 1.0
        assert result.l_thread_score == pytest.approx(1.73, abs=0.1)


class TestSingleStretch:
    """Test single stretch [60]."""

    def test_single_stretch(self):
        data = _make_autonomy_session([60])
        from omas.metrics.autonomy import compute_autonomy

        result = compute_autonomy(data)

        # v2.1: P75 = 60, consistency always 1.0
        assert result.p75_autonomous_stretch_minutes == pytest.approx(60.0, abs=2.0)
        assert result.consistency_factor == 1.0
        assert result.l_thread_score == pytest.approx(10.0, abs=0.2)


class TestMonotonicity:
    """Test that longer/more consistent sessions score higher."""

    def test_longer_stretches_score_higher(self):
        from omas.metrics.autonomy import compute_autonomy

        data_higher = _make_autonomy_session([5, 10, 15])
        data_lower = _make_autonomy_session([5, 10, 12])
        score_higher = compute_autonomy(data_higher).l_thread_score
        score_lower = compute_autonomy(data_lower).l_thread_score
        assert score_higher > score_lower

    def test_higher_p75_beats_lower_p75(self):
        """v2.1: Without CV penalty, higher P75 wins regardless of consistency."""
        from omas.metrics.autonomy import compute_autonomy

        data_high_p75 = _make_autonomy_session([60, 1, 1])
        data_low_p75 = _make_autonomy_session([10, 10, 10])
        score_high = compute_autonomy(data_high_p75).l_thread_score
        score_low = compute_autonomy(data_low_p75).l_thread_score
        assert score_high > score_low


class TestEdgeCases:
    """Test edge cases for autonomy v2.0."""

    def test_empty_stretches(self):
        from omas.metrics.autonomy import compute_autonomy

        data = _make_autonomy_session([])
        result = compute_autonomy(data)
        assert result.l_thread_score == 0.0
        assert result.p75_autonomous_stretch_minutes == 0.0

    def test_two_stretches(self):
        from omas.metrics.autonomy import compute_autonomy

        data = _make_autonomy_session([10, 20])
        result = compute_autonomy(data)
        # Should produce valid scores without error
        assert result.l_thread_score > 0.0
        assert result.p75_autonomous_stretch_minutes > 0.0
        assert result.consistency_factor == 1.0  # v2.1: always 1.0

    def test_three_stretches(self):
        from omas.metrics.autonomy import compute_autonomy

        data = _make_autonomy_session([10, 20, 30])
        result = compute_autonomy(data)
        assert result.l_thread_score > 0.0
        assert result.p75_autonomous_stretch_minutes > 0.0
        assert result.consistency_factor == 1.0  # v2.1: always 1.0

    def test_score_capped_at_10(self):
        """Score must never exceed 10.0 regardless of input."""
        from omas.metrics.autonomy import compute_autonomy

        data = _make_autonomy_session([200, 200, 200, 200])
        result = compute_autonomy(data)
        assert result.l_thread_score <= 10.0

    def test_consistency_factor_bounded(self):
        """Consistency factor should always be in (0, 1]."""
        from omas.metrics.autonomy import compute_autonomy

        for stretches in [[1, 1, 1], [100, 1], [5, 10, 15, 20, 25]]:
            result = compute_autonomy(_make_autonomy_session(stretches))
            assert result.consistency_factor == 1.0  # v2.1: always 1.0
