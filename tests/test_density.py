"""Tests for density metrics (Bug #2 verification)."""
import pytest
from omas.models import SessionData, ToolCall, SubAgentInfo
from omas.metrics.density import compute_density
from datetime import datetime, timedelta


def _make_density_session(num_tools: int, num_subagents: int, depth: int = 1, duration_min: float = 60) -> SessionData:
    t0 = datetime(2026, 1, 1, 10, 0)
    data = SessionData(session_id="test")
    data.start_time = t0
    data.end_time = t0 + timedelta(minutes=duration_min)
    for i in range(num_tools):
        data.tool_calls.append(
            ToolCall(name="Bash", tool_use_id=f"t{i}", timestamp=t0 + timedelta(seconds=i * 10))
        )
    for i in range(num_subagents):
        sa = SubAgentInfo(
            agent_id=f"agent-{i}",
            first_seen=t0,
            last_seen=t0 + timedelta(minutes=30),
        )
        if depth >= 2:
            sa.has_nested_agents = True
        data.sub_agents.append(sa)
    data.assistant_message_count = num_tools
    return data


class TestDensityLogNormalization:
    def test_b_score_capped_at_10(self):
        """B-score should never exceed 10, even with many sub-agents."""
        data = _make_density_session(100, 50, depth=2)
        result = compute_density(data)
        assert result.b_thread_score <= 10.0

    def test_zero_subagents(self):
        data = _make_density_session(10, 0)
        result = compute_density(data)
        assert result.b_thread_score == 0.0

    def test_one_subagent(self):
        data = _make_density_session(10, 1)
        result = compute_density(data)
        assert 1.5 <= result.b_thread_score <= 3.0

    def test_ten_subagents_depth_1(self):
        data = _make_density_session(100, 10)
        result = compute_density(data)
        assert 6.0 <= result.b_thread_score <= 8.0

    def test_26_subagents_depth_1(self):
        """Session A scenario: 26 sub-agents, depth 1."""
        data = _make_density_session(3650, 26)
        result = compute_density(data)
        assert 9.0 <= result.b_thread_score <= 10.0
        assert result.b_thread_score <= 10.0

    def test_monotonically_increasing(self):
        """More sub-agents should give higher scores."""
        scores = []
        for n in [1, 5, 10, 20, 50]:
            data = _make_density_session(100, n)
            result = compute_density(data)
            scores.append(result.b_thread_score)
        for i in range(1, len(scores)):
            assert scores[i] > scores[i - 1]
