"""Tests for density metrics."""
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


class TestDensityLinearScoring:
    """Thicker score = min(total_agents, 10). Linear, 10 agents = perfect."""

    def test_zero_agents(self):
        data = _make_density_session(10, 0)
        result = compute_density(data)
        assert result.b_thread_score == 0.0

    def test_one_agent(self):
        data = _make_density_session(10, 1)
        result = compute_density(data)
        assert result.b_thread_score == 1.0

    def test_five_agents(self):
        data = _make_density_session(100, 5)
        result = compute_density(data)
        assert result.b_thread_score == 5.0

    def test_ten_agents_is_max(self):
        data = _make_density_session(100, 10)
        result = compute_density(data)
        assert result.b_thread_score == 10.0

    def test_capped_at_10(self):
        """More than 10 agents should still cap at 10."""
        data = _make_density_session(100, 50)
        result = compute_density(data)
        assert result.b_thread_score == 10.0

    def test_depth_does_not_multiply(self):
        """Depth 2 should NOT multiply the score — just total count matters."""
        data_flat = _make_density_session(100, 5, depth=1)
        data_nested = _make_density_session(100, 5, depth=2)
        flat = compute_density(data_flat)
        nested = compute_density(data_nested)
        assert flat.b_thread_score == nested.b_thread_score == 5.0

    def test_monotonically_increasing(self):
        """More agents should give higher scores."""
        scores = []
        for n in [1, 5, 8, 10]:
            data = _make_density_session(100, n)
            result = compute_density(data)
            scores.append(result.b_thread_score)
        for i in range(1, len(scores)):
            assert scores[i] > scores[i - 1]
