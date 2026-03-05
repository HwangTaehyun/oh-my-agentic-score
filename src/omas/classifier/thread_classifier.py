"""Thread type classification based on IndyDevDan's framework.

Classification priority (most specific first):
1. Z-thread: Zero-touch (minimal human, significant work)
2. B-thread: Big (nested sub-agents)
3. L-thread: Long (extended autonomous stretch)
4. F-thread: Fusion (similar prompts to multiple agents)
5. P-thread: Parallel (concurrent agents)
6. C-thread: Chained (multiple checkpoints)
7. Base: Default
"""

from __future__ import annotations

from omas.config import (
    B_THREAD_MIN_DEPTH,
    C_THREAD_MIN_HUMAN_MESSAGES,
    C_THREAD_MIN_TOOLS_PER_GAP,
    F_THREAD_MIN_SIMILARITY,
    L_THREAD_MIN_AUTONOMOUS_MINUTES,
    L_THREAD_MIN_TOOL_CALLS,
    P_THREAD_MIN_CONCURRENT,
    Z_THREAD_MAX_HUMAN_MESSAGES,
    Z_THREAD_MIN_TOOL_CALLS,
)
from omas.models import (
    AutonomyMetrics,
    DensityMetrics,
    ParallelismMetrics,
    SessionData,
    ThreadType,
    TrustMetrics,
)


def classify_thread(
    data: SessionData,
    parallelism: ParallelismMetrics,
    autonomy: AutonomyMetrics,
    density: DensityMetrics,
    trust: TrustMetrics,
) -> ThreadType:
    """Classify a session into one of the 7 thread types.

    Evaluated in priority order (most specific first).
    """
    total_tools = len(data.tool_calls)
    human_count = len(data.human_messages)

    # 1. Z-thread: Zero-touch
    if human_count <= Z_THREAD_MAX_HUMAN_MESSAGES and total_tools >= Z_THREAD_MIN_TOOL_CALLS:
        return ThreadType.Z

    # 2. B-thread: Big (nested sub-agents)
    if density.max_sub_agent_depth >= B_THREAD_MIN_DEPTH:
        return ThreadType.B

    # 3. L-thread: Long autonomous stretch
    if (
        autonomy.longest_autonomous_stretch_minutes >= L_THREAD_MIN_AUTONOMOUS_MINUTES
        and total_tools >= L_THREAD_MIN_TOOL_CALLS
    ):
        return ThreadType.L

    # 4. F-thread: Fusion (similar prompts to multiple agents)
    if _detect_fusion(data):
        return ThreadType.F

    # 5. P-thread: Parallel execution (cross-session concurrency)
    if parallelism.concurrent_sessions >= P_THREAD_MIN_CONCURRENT:
        return ThreadType.P

    # 6. C-thread: Chained (multiple human checkpoints)
    if _detect_chained(data, human_count, total_tools):
        return ThreadType.C

    # 7. Base: Default
    return ThreadType.BASE


def _detect_fusion(data: SessionData) -> bool:
    """Detect if multiple sub-agents received substantially similar prompts.

    Uses Jaccard word similarity between sub-agent prompts.
    """
    prompts = [sa.prompt_preview for sa in data.sub_agents if sa.prompt_preview]
    if len(prompts) < 2:
        return False

    for i in range(len(prompts)):
        for j in range(i + 1, len(prompts)):
            if _jaccard_similarity(prompts[i], prompts[j]) >= F_THREAD_MIN_SIMILARITY:
                return True
    return False


def _jaccard_similarity(a: str, b: str) -> float:
    """Compute Jaccard word similarity between two strings."""
    words_a = set(a.lower().split())
    words_b = set(b.lower().split())
    if not words_a or not words_b:
        return 0.0
    intersection = len(words_a & words_b)
    union = len(words_a | words_b)
    return intersection / union if union > 0 else 0.0


def _detect_chained(data: SessionData, human_count: int, total_tools: int) -> bool:
    """Detect chained thread pattern (multiple human checkpoints with work between each)."""
    if human_count < C_THREAD_MIN_HUMAN_MESSAGES:
        return False

    human_msgs = sorted(data.human_messages, key=lambda m: m.timestamp)
    tool_calls = sorted(data.tool_calls, key=lambda t: t.timestamp)

    # Check that each gap between human messages has sufficient tool calls
    for i in range(len(human_msgs) - 1):
        calls_in_gap = sum(
            1
            for t in tool_calls
            if human_msgs[i].timestamp < t.timestamp < human_msgs[i + 1].timestamp
        )
        if calls_in_gap < C_THREAD_MIN_TOOLS_PER_GAP:
            return False

    return True
