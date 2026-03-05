"""Tests for Thicker v2.0 density scoring (multi-factor + anti-spam)."""

from datetime import datetime, timedelta

from omas.metrics.density import compute_density
from omas.models import SessionData, SubAgentInfo, ToolCall

# Tool sets matching the v2.0 implementation constants
TEAM_ACTION_TOOLS = {"TeamCreate", "TaskCreate", "TaskUpdate", "SendMessage"}
TEAM_QUERY_TOOLS = {"TaskGet", "TaskList"}


def _make_density_session(
    agents: int = 0,
    depth: int = 1,
    action_calls: int = 0,
    query_calls: int = 0,
) -> SessionData:
    """Build a minimal SessionData for density v2.0 tests.

    Args:
        agents: Number of sub-agents.
        depth: Max nesting depth (1 = flat, 2+ = nested).
        action_calls: Number of team action tool calls (TeamCreate etc.).
        query_calls: Number of team query tool calls (TaskGet etc.).
    """
    t0 = datetime(2026, 1, 1, 10, 0)
    data = SessionData(session_id="density-v2-test")
    data.start_time = t0
    data.end_time = t0 + timedelta(minutes=60)

    # Sub-agents
    for i in range(agents):
        sa = SubAgentInfo(
            agent_id=f"agent-{i}",
            first_seen=t0,
            last_seen=t0 + timedelta(minutes=30),
        )
        if depth >= 2:
            sa.has_nested_agents = True
        data.sub_agents.append(sa)

    # Team action tool calls
    tool_idx = 0
    action_tool_names = list(TEAM_ACTION_TOOLS)
    for i in range(action_calls):
        name = action_tool_names[i % len(action_tool_names)]
        data.tool_calls.append(
            ToolCall(
                name=name,
                tool_use_id=f"action-{tool_idx}",
                timestamp=t0 + timedelta(seconds=tool_idx * 5),
            )
        )
        tool_idx += 1

    # Team query tool calls
    query_tool_names = list(TEAM_QUERY_TOOLS)
    for i in range(query_calls):
        name = query_tool_names[i % len(query_tool_names)]
        data.tool_calls.append(
            ToolCall(
                name=name,
                tool_use_id=f"query-{tool_idx}",
                timestamp=t0 + timedelta(seconds=tool_idx * 5),
            )
        )
        tool_idx += 1

    data.assistant_message_count = action_calls + query_calls
    return data


class TestBaseScoreOnly:
    """Base score = min(len(sub_agents), 10.0), no depth/team modifiers."""

    def test_five_agents(self):
        data = _make_density_session(agents=5, depth=1)
        result = compute_density(data)
        assert result.b_thread_score == 5.0

    def test_ten_agents(self):
        data = _make_density_session(agents=10, depth=1)
        result = compute_density(data)
        assert result.b_thread_score == 10.0


class TestDepthMultiplier:
    """Depth multiplier = 1.0 + (max_depth - 1) * 0.2 for depth >= 2."""

    def test_depth_1_no_multiplier(self):
        # 5 agents, depth 1 -> base=5.0, mult=1.0 -> 5.0
        data = _make_density_session(agents=5, depth=1)
        result = compute_density(data)
        assert result.b_thread_score == 5.0

    def test_depth_2(self):
        # 5 agents, depth 2 -> base=5.0, mult=1.2 -> 6.0
        data = _make_density_session(agents=5, depth=2)
        result = compute_density(data)
        assert result.b_thread_score == 6.0

    def test_depth_2_max_current(self):
        # _compute_max_depth currently caps at 2 for nested agents
        # 5 agents, depth 2 -> base=5.0, mult=1.2 -> 6.0
        data = _make_density_session(agents=5, depth=2)
        result = compute_density(data)
        assert result.max_sub_agent_depth == 2
        assert result.b_thread_score == 6.0


class TestTeamBonus:
    """Team bonus = min(effective_team_score / 10.0, 2.0)."""

    def test_action_calls_bonus(self):
        # 5 agents, 15 actions, 0 queries -> effective=15.0, bonus=min(1.5, 2.0)=1.5
        # score = 5.0 * 1.0 + 1.5 = 6.5
        data = _make_density_session(agents=5, action_calls=15)
        result = compute_density(data)
        assert result.b_thread_score == 6.5

    def test_bonus_capped_at_2(self):
        # 5 agents, 20 actions -> effective=20.0, bonus=min(2.0, 2.0)=2.0
        # score = 5.0 * 1.0 + 2.0 = 7.0
        data = _make_density_session(agents=5, action_calls=20)
        result = compute_density(data)
        assert result.b_thread_score == 7.0


class TestAntiSpam:
    """Query tool calls are discounted: effective = actions + queries * 0.1."""

    def test_query_only_spam(self):
        # 0 agents, 0 actions, 100 queries -> effective=10.0, but anti-gaming: no agents = no bonus
        # base=0.0, score = 0.0
        data = _make_density_session(agents=0, query_calls=100)
        result = compute_density(data)
        assert result.effective_team_score == 10.0
        assert result.b_thread_score == 0.0

    def test_mixed_actions_and_queries(self):
        # 0 agents, 5 actions, 100 queries -> effective=15.0, but anti-gaming: no agents = no bonus
        # base=0.0, score = 0.0
        data = _make_density_session(agents=0, action_calls=5, query_calls=100)
        result = compute_density(data)
        assert result.effective_team_score == 15.0
        assert result.b_thread_score == 0.0

    def test_query_discount_factor(self):
        # 10 queries -> effective = 0 + 10*0.1 = 1.0
        data = _make_density_session(agents=0, query_calls=10)
        result = compute_density(data)
        assert result.effective_team_score == 1.0


class TestAntiGaming:
    """Test anti-gaming: zero agents should not score from team bonus."""

    def test_zero_agents_zero_score(self):
        """No agents + team calls should give 0 score."""
        data = _make_density_session(0, action_calls=20, query_calls=100)
        result = compute_density(data)

        assert result.team_action_calls == 20
        assert result.team_query_calls == 100
        assert result.effective_team_score == 30.0  # 20 + 100*0.1
        assert result.b_thread_score == 0.0  # Agent 없으면 0

    def test_one_agent_gets_bonus(self):
        """1 agent + team calls should get bonus."""
        data = _make_density_session(1, action_calls=20)
        result = compute_density(data)

        assert result.b_thread_score == 3.0  # 1 + 2.0 (bonus)


class TestCombined:
    """All factors combined: min(base * depth_mult + team_bonus, 10.0)."""

    def test_agents_depth_actions(self):
        # 5 agents, depth 2, 15 actions -> base=5, mult=1.2, bonus=1.5
        # score = 5*1.2 + 1.5 = 7.5
        data = _make_density_session(agents=5, depth=2, action_calls=15)
        result = compute_density(data)
        assert result.b_thread_score == 7.5

    def test_capped_at_10(self):
        # 10 agents, depth 3, 20 actions -> base=10, mult=1.4, bonus=2.0
        # raw = 10*1.4 + 2.0 = 16.0 -> capped at 10.0
        data = _make_density_session(agents=10, depth=3, action_calls=20)
        result = compute_density(data)
        assert result.b_thread_score == 10.0

    def test_metrics_fields_populated(self):
        # Verify v2.0 fields are returned
        data = _make_density_session(agents=3, depth=2, action_calls=5, query_calls=10)
        result = compute_density(data)
        assert result.team_action_calls == 5
        assert result.team_query_calls == 10
        assert result.effective_team_score == 5 + 10 * 0.1  # 6.0
        assert result.max_sub_agent_depth == 2


class TestMonotonicity:
    """Score should increase with more depth and more team actions."""

    def test_depth_monotonic(self):
        s1 = compute_density(_make_density_session(agents=5, depth=1))
        s2 = compute_density(_make_density_session(agents=5, depth=2))
        assert s2.b_thread_score > s1.b_thread_score

    def test_action_monotonic(self):
        s1 = compute_density(_make_density_session(agents=5, action_calls=10))
        s2 = compute_density(_make_density_session(agents=5, action_calls=20))
        assert s2.b_thread_score > s1.b_thread_score

    def test_agent_count_monotonic(self):
        s1 = compute_density(_make_density_session(agents=3))
        s2 = compute_density(_make_density_session(agents=7))
        assert s2.b_thread_score > s1.b_thread_score
