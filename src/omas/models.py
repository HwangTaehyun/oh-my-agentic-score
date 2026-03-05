"""Pydantic data models for thread measurement."""

from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

# Idle gap threshold: gaps longer than this between consecutive activity
# timestamps are excluded from session duration (e.g., user left permission
# prompt unanswered for hours/days).
IDLE_GAP_THRESHOLD = timedelta(minutes=30)


class ThreadType(str, Enum):
    """Thread type classification based on IndyDevDan's framework."""

    BASE = "Base"
    P = "P-thread"  # Parallel
    C = "C-thread"  # Chained
    F = "F-thread"  # Fusion
    B = "B-thread"  # Big (nested sub-agents)
    L = "L-thread"  # Long
    Z = "Z-thread"  # Zero-touch


class ToolCall(BaseModel):
    """A single tool call extracted from an assistant message."""

    name: str
    tool_use_id: str
    timestamp: datetime
    is_subagent: bool = False
    agent_id: Optional[str] = None


class UserMessage(BaseModel):
    """A user message record."""

    timestamp: datetime
    is_human: bool  # True = typed by human, False = tool_result/automated
    content_preview: str = ""


class SubAgentInfo(BaseModel):
    """Information about a sub-agent detected in a session."""

    agent_id: str
    first_seen: datetime
    last_seen: datetime
    tool_call_count: int = 0
    has_nested_agents: bool = False
    prompt_preview: str = ""


class TokenUsage(BaseModel):
    """Accumulated token usage for a session."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_creation_tokens: int = 0

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


class SessionData(BaseModel):
    """Parsed data from a single session JSONL file."""

    session_id: str
    project_path: str = ""
    project_hash: str = ""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    model: str = "unknown"

    # Raw counts
    tool_calls: list[ToolCall] = Field(default_factory=list)
    user_messages: list[UserMessage] = Field(default_factory=list)
    assistant_message_count: int = 0

    # Sub-agent data
    sub_agents: list[SubAgentInfo] = Field(default_factory=list)
    subagent_jsonl_count: int = 0

    # Token usage
    total_usage: TokenUsage = Field(default_factory=TokenUsage)

    # Agent progress events for concurrency detection: (agent_id, timestamp)
    agent_events: list[tuple[str, datetime]] = Field(default_factory=list)

    # Peak parallel tool calls in a single assistant message
    peak_parallel_tools_in_message: int = 0

    # AI-written lines of code (accumulated from Write/Edit/MultiEdit tool inputs)
    ai_written_lines: int = 0

    @property
    def human_messages(self) -> list[UserMessage]:
        """Only messages typed by a human."""
        return [m for m in self.user_messages if m.is_human]

    @property
    def duration_minutes(self) -> float:
        """Active session duration in minutes (idle gaps excluded).

        Collects all activity timestamps (tool calls, user messages, assistant
        messages), sorts them, and sums only the gaps that are shorter than
        ``IDLE_GAP_THRESHOLD``.  This prevents idle periods (e.g., user left a
        permission prompt unanswered for hours) from inflating session duration
        and composite score weights.
        """
        if not self.start_time or not self.end_time:
            return 0.0

        # Gather all activity timestamps
        timestamps: list[datetime] = []
        if self.start_time:
            timestamps.append(self.start_time)
        for tc in self.tool_calls:
            timestamps.append(tc.timestamp)
        for um in self.user_messages:
            timestamps.append(um.timestamp)
        if self.end_time:
            timestamps.append(self.end_time)

        if len(timestamps) < 2:
            return 0.0

        timestamps.sort()

        # Sum only active gaps (shorter than threshold)
        active_seconds = 0.0
        for i in range(1, len(timestamps)):
            gap = timestamps[i] - timestamps[i - 1]
            if gap <= IDLE_GAP_THRESHOLD:
                active_seconds += gap.total_seconds()
            else:
                # Cap idle gaps at the threshold value so sessions with
                # occasional pauses still get some duration credit
                active_seconds += IDLE_GAP_THRESHOLD.total_seconds()

        return max(active_seconds / 60.0, 0.0)

    @property
    def wall_clock_minutes(self) -> float:
        """Total wall-clock duration (start to end, including idle gaps)."""
        if self.start_time and self.end_time:
            delta = (self.end_time - self.start_time).total_seconds()
            return max(delta / 60.0, 0.0)
        return 0.0


# --- Metric Models ---


class ParallelismMetrics(BaseModel):
    """'More' dimension - parallel execution paths."""

    max_concurrent_agents: int = 0
    total_sub_agents: int = 0
    peak_parallel_tools: int = 0
    p_thread_score: float = 0.0


class AutonomyMetrics(BaseModel):
    """'Longer' dimension - extended duration without intervention."""

    longest_autonomous_stretch_minutes: float = 0.0
    max_tool_calls_between_human: int = 0
    session_duration_minutes: float = 0.0
    max_consecutive_assistant_turns: int = 0
    l_thread_score: float = 0.0


class DensityMetrics(BaseModel):
    """'Thicker' dimension - more work per unit time."""

    tool_calls_per_minute: float = 0.0
    max_sub_agent_depth: int = 0
    total_tool_calls: int = 0
    tokens_per_minute: float = 0.0
    b_thread_score: float = 0.0
    # AI-written lines bonus
    ai_written_lines: int = 0
    ai_line_bonus: float = 0.0


class TrustMetrics(BaseModel):
    """'Fewer' dimension - reduce human checkpoints."""

    tool_calls_per_human_message: float = 0.0
    assistant_per_human_ratio: float = 0.0
    ask_user_count: int = 0
    plan_mode_ask_user_count: int = 0  # AskUser in plan mode (excluded from penalty)
    penalized_ask_user_count: int = 0  # AskUser outside plan mode (penalized)
    autonomous_tool_call_pct: float = 0.0
    z_thread_score: float = 0.0
    # Trivial delegation: human msgs followed by ≤ TRIVIAL_DELEGATION_THRESHOLD tool calls
    trivial_delegation_count: int = 0  # human msgs classified as trivial delegation
    effective_human_count: int = 0  # human msgs actually used in trust ratio


class SessionMetrics(BaseModel):
    """Complete metrics for a single session."""

    session_id: str
    project_path: str = ""
    project_hash: str = ""
    timestamp: Optional[datetime] = None
    model: str = "unknown"
    thread_type: ThreadType = ThreadType.BASE
    session_duration_minutes: float = 0.0
    total_tool_calls: int = 0
    total_human_messages: int = 0

    parallelism: ParallelismMetrics = Field(default_factory=ParallelismMetrics)
    autonomy: AutonomyMetrics = Field(default_factory=AutonomyMetrics)
    density: DensityMetrics = Field(default_factory=DensityMetrics)
    trust: TrustMetrics = Field(default_factory=TrustMetrics)

    # Per-tool-name usage counts (e.g., {"Read": 45, "Bash": 30, "Skill": 3})
    tool_breakdown: dict[str, int] = Field(default_factory=dict)

    # AI-written lines of code (top-level shortcut from density)
    ai_written_lines: int = 0

    overall_score: float = 0.0


class ProjectSummary(BaseModel):
    """Aggregated metrics for a project."""

    project_path: str
    project_hash: str
    session_count: int = 0
    total_tool_calls: int = 0
    # Raw dimension averages (for data export / cloud upload)
    avg_parallelism_score: float = 0.0
    avg_autonomy_score: float = 0.0
    avg_density_score: float = 0.0
    avg_trust_score: float = 0.0
    # Normalized dimension averages (0-10 scale, used for dashboard display)
    avg_parallelism_norm: float = 0.0
    avg_autonomy_norm: float = 0.0
    avg_density_norm: float = 0.0
    avg_trust_norm: float = 0.0
    avg_overall_score: float = 0.0
    dominant_thread_type: ThreadType = ThreadType.BASE
    thread_type_distribution: dict[str, int] = Field(default_factory=dict)
    sessions: list[str] = Field(default_factory=list)  # session IDs


class ComparisonMetrics(BaseModel):
    """Aggregated comparison metrics for fair cross-user/cross-project comparison."""

    qualified_session_count: int = 0
    excluded_session_count: int = 0
    weighted_overall_score: float = 0.0
    consistency_score: float = 0.0
    composite_rank_score: float = 0.0  # weighted 80% + consistency 20%


class ExportData(BaseModel):
    """Full export format for the Next.js dashboard."""

    generated_at: datetime
    total_sessions: int = 0
    sessions: list[SessionMetrics] = Field(default_factory=list)
    projects: list[ProjectSummary] = Field(default_factory=list)
    comparison: Optional[ComparisonMetrics] = None
