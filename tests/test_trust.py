"""Tests for the Fewer (F) dimension trust metrics, including trivial delegation filtering."""

from __future__ import annotations

import math
from datetime import datetime, timedelta

import pytest

from omas.config import TRIVIAL_DELEGATION_THRESHOLD
from omas.metrics.trust import _count_effective_human_messages, compute_trust
from omas.models import SessionData, ToolCall, UserMessage


def _ts(minutes: int) -> datetime:
    """Helper: returns a datetime offset by *minutes* from a fixed base."""
    return datetime(2025, 1, 1, 10, 0, 0) + timedelta(minutes=minutes)


def _human(minutes: int, preview: str = "") -> UserMessage:
    return UserMessage(timestamp=_ts(minutes), is_human=True, content_preview=preview)


def _tool(minutes: int, name: str = "Read") -> ToolCall:
    return ToolCall(name=name, tool_use_id=f"t-{minutes}", timestamp=_ts(minutes))


# ---------------------------------------------------------------------------
# _count_effective_human_messages
# ---------------------------------------------------------------------------


class TestCountEffectiveHumanMessages:
    """Unit tests for the trivial delegation detection function."""

    def test_no_human_messages(self):
        """Empty human list returns (0, 0)."""
        eff, triv = _count_effective_human_messages([], [_tool(1)])
        assert (eff, triv) == (0, 0)

    def test_all_trivial(self):
        """All human segments have ≤ threshold tools → all trivial, effective = 1 (floor)."""
        humans = [_human(0), _human(10), _human(20)]
        tools = [
            _tool(1),                    # segment 0→10: 1 tool  (trivial)
            _tool(11), _tool(12),        # segment 10→20: 2 tools (trivial)
            _tool(21), _tool(22), _tool(23),  # segment 20→∞: 3 tools (trivial)
        ]
        eff, triv = _count_effective_human_messages(humans, tools)
        assert triv == 3
        assert eff == 1  # floor

    def test_none_trivial(self):
        """All segments have > threshold tools → no trivials."""
        humans = [_human(0), _human(10)]
        # 6 tools in each segment (> default threshold of 5)
        tools = [_tool(i) for i in range(1, 7)]  # segment 0→10: 6 tools
        tools += [_tool(i) for i in range(11, 18)]  # segment 10→∞: 7 tools
        eff, triv = _count_effective_human_messages(humans, tools)
        assert triv == 0
        assert eff == 2

    def test_mixed_segments(self):
        """The plan scenario: 3 humans → [2, 40, 3] tool counts."""
        humans = [_human(0), _human(100), _human(200)]
        tools = (
            [_tool(1), _tool(2)]  # segment 0→100: 2 tools (trivial)
            + [_tool(i) for i in range(101, 141)]  # segment 100→200: 40 tools (real)
            + [_tool(201), _tool(202), _tool(203)]  # segment 200→∞: 3 tools (trivial)
        )
        eff, triv = _count_effective_human_messages(humans, tools)
        assert triv == 2
        assert eff == 1  # 3 - 2 = 1

    def test_custom_threshold(self):
        """Respect a custom threshold parameter."""
        humans = [_human(0)]
        tools = [_tool(i) for i in range(1, 4)]  # 3 tools in segment
        # threshold=3 → 3 ≤ 3 → trivial
        eff, triv = _count_effective_human_messages(humans, tools, threshold=3)
        assert triv == 1
        assert eff == 1  # floor
        # threshold=2 → 3 > 2 → NOT trivial
        eff, triv = _count_effective_human_messages(humans, tools, threshold=2)
        assert triv == 0
        assert eff == 1

    def test_single_human_with_many_tools(self):
        """Single human with 50 tools → not trivial."""
        humans = [_human(0)]
        tools = [_tool(i) for i in range(1, 51)]
        eff, triv = _count_effective_human_messages(humans, tools)
        assert triv == 0
        assert eff == 1

    def test_single_human_with_few_tools(self):
        """Single human with 2 tools → trivial, but eff floors at 1."""
        humans = [_human(0)]
        tools = [_tool(1), _tool(2)]
        eff, triv = _count_effective_human_messages(humans, tools)
        assert triv == 1
        assert eff == 1  # floor

    def test_boundary_exactly_at_threshold(self):
        """Exactly threshold tools → trivial (≤ not <)."""
        humans = [_human(0)]
        tools = [_tool(i) for i in range(1, TRIVIAL_DELEGATION_THRESHOLD + 1)]
        eff, triv = _count_effective_human_messages(humans, tools)
        assert triv == 1  # exactly at threshold → trivial

    def test_boundary_one_over_threshold(self):
        """threshold + 1 tools → NOT trivial."""
        humans = [_human(0)]
        tools = [_tool(i) for i in range(1, TRIVIAL_DELEGATION_THRESHOLD + 2)]
        eff, triv = _count_effective_human_messages(humans, tools)
        assert triv == 0


# ---------------------------------------------------------------------------
# compute_trust (integration-level)
# ---------------------------------------------------------------------------


class TestComputeTrustTrivialDelegation:
    """Integration tests: compute_trust should use effective human count."""

    def _make_session(
        self,
        humans: list[UserMessage],
        tools: list[ToolCall],
        assistant_count: int = 10,
    ) -> SessionData:
        all_user = humans + [
            UserMessage(timestamp=_ts(999), is_human=False, content_preview="tool_result")
        ]
        return SessionData(
            session_id="test-session",
            user_messages=all_user,
            tool_calls=tools,
            assistant_message_count=assistant_count,
            start_time=_ts(0),
            end_time=_ts(100),
        )

    def test_trivial_delegations_boost_score(self):
        """With trivial delegations excluded, ratio goes up → score goes up."""
        humans = [_human(0), _human(100), _human(200)]
        tools = (
            [_tool(1), _tool(2)]  # segment 0→100: 2 tools (trivial)
            + [_tool(i) for i in range(101, 141)]  # segment 100→200: 40 tools (real)
            + [_tool(201), _tool(202), _tool(203)]  # segment 200→∞: 3 tools (trivial)
        )
        total_tools = len(tools)  # 2 + 40 + 3 = 45
        session = self._make_session(humans, tools)
        result = compute_trust(session)

        # Verify trivial delegation fields
        assert result.trivial_delegation_count == 2
        assert result.effective_human_count == 1

        # Effective ratio = 45 / 1 = 45.0 (not 45/3 = 15.0)
        assert result.tool_calls_per_human_message == float(total_tools)

        # Score with effective ratio: log1p(45) * 2.0
        expected_score = min(math.log1p(float(total_tools)) * 2.0, 10.0)
        assert abs(result.z_thread_score - round(expected_score, 2)) < 0.01

    def test_no_trivial_delegations(self):
        """All segments have > 5 tools → no change from old behavior."""
        humans = [_human(0), _human(10)]
        tools = [_tool(i) for i in range(1, 8)] + [_tool(i) for i in range(11, 20)]
        session = self._make_session(humans, tools)
        result = compute_trust(session)

        assert result.trivial_delegation_count == 0
        assert result.effective_human_count == 2
        # ratio = 16 / 2 = 8.0
        assert result.tool_calls_per_human_message == 8.0

    def test_zero_human_messages(self):
        """No human messages → effective=0, trivial=0, floor at 1 for ratio."""
        session = SessionData(
            session_id="test-zero",
            user_messages=[
                UserMessage(timestamp=_ts(0), is_human=False, content_preview="auto"),
            ],
            tool_calls=[_tool(1), _tool(2)],
            assistant_message_count=2,
            start_time=_ts(0),
            end_time=_ts(5),
        )
        result = compute_trust(session)
        assert result.effective_human_count == 0
        assert result.trivial_delegation_count == 0
        # Falls back to max(0, 1) = 1 in the ratio
        assert result.tool_calls_per_human_message == 2.0


class TestFewToolsHighRatio:
    """Fewer score should reward high ratio regardless of absolute volume."""

    def test_few_tools_high_ratio(self):
        """20 tools / 1 human = ratio 20 → should still get decent score."""
        from datetime import datetime, timedelta

        t0 = datetime(2026, 1, 1, 10, 0)
        data = SessionData(session_id="test")
        data.start_time = t0
        data.end_time = t0 + timedelta(hours=1)
        for i in range(20):
            data.tool_calls.append(
                ToolCall(name="Bash", tool_use_id=f"t{i}", timestamp=t0 + timedelta(minutes=i))
            )
        data.user_messages.append(
            UserMessage(timestamp=t0, is_human=True, content_preview="do it")
        )
        data.assistant_message_count = 20

        result = compute_trust(data)
        # ratio 20 → log1p(20) * 2.0 ≈ 6.1, no volume penalty
        assert result.z_thread_score > 6.0

    def test_many_tools_high_ratio(self):
        """200 tools / 1 human = ratio 200 → higher score than 20/1."""
        from datetime import datetime, timedelta

        t0 = datetime(2026, 1, 1, 10, 0)
        data = SessionData(session_id="test")
        data.start_time = t0
        data.end_time = t0 + timedelta(hours=2)
        for i in range(200):
            data.tool_calls.append(
                ToolCall(name="Bash", tool_use_id=f"t{i}", timestamp=t0 + timedelta(seconds=i * 30))
            )
        data.user_messages.append(
            UserMessage(timestamp=t0, is_human=True, content_preview="do it")
        )
        data.assistant_message_count = 200

        result = compute_trust(data)
        assert result.z_thread_score > 7.0
