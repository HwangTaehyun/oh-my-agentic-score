"""'More' dimension - Parallelism metrics (P-threads)."""

from __future__ import annotations

from datetime import datetime

from omas.models import ParallelismMetrics, SessionData


def compute_cross_session_parallelism(
    session_ranges: list[tuple[str, datetime, datetime]],
) -> dict[str, int]:
    """Compute concurrent session count for each session using pairwise overlap.

    Args:
        session_ranges: List of (session_id, start_time, end_time) tuples.

    Returns:
        Dict mapping session_id to max concurrent sessions (including self).
        Two sessions overlap if A.start < B.end AND B.start < A.end.
    """
    result: dict[str, int] = {}
    n = len(session_ranges)
    for i in range(n):
        sid_a, start_a, end_a = session_ranges[i]
        count = 1  # count self
        for j in range(n):
            if i == j:
                continue
            _sid_b, start_b, end_b = session_ranges[j]
            # Two sessions overlap if A.start < B.end AND B.start < A.end
            if start_a < end_b and start_b < end_a:
                count += 1
        result[sid_a] = count
    return result


def compute_parallelism(
    data: SessionData,
    concurrent_sessions: int = 1,
) -> ParallelismMetrics:
    """Compute parallelism metrics for a session.

    Measures cross-session concurrency (P-thread) and within-session
    concurrency (informational, fed into B-thread density).

    Args:
        data: Parsed session data.
        concurrent_sessions: Number of sessions running concurrently
            (from cross-session overlap analysis).
    """
    max_concurrent = _find_max_concurrent_agents(data.agent_events)
    total_sub_agents = len(data.sub_agents)
    peak_parallel = data.peak_parallel_tools_in_message

    # Temporal overlap: detect overlapping tool call time windows
    peak_temporal = _find_peak_temporal_overlap(data.tool_calls)

    # P-thread score: cross-session concurrency (capped at 10)
    p_score = min(float(concurrent_sessions), 10.0)

    return ParallelismMetrics(
        max_concurrent_agents=max_concurrent,
        total_sub_agents=total_sub_agents,
        peak_parallel_tools=peak_parallel,
        peak_temporal_overlap=peak_temporal,
        concurrent_sessions=concurrent_sessions,
        p_thread_score=p_score,
    )


def _find_peak_temporal_overlap(
    tool_calls: list,
) -> int:
    """Find the peak number of temporally overlapping tool calls.

    Groups tool calls by timestamp; calls sharing the exact same timestamp
    are considered concurrent (they were dispatched in parallel).
    Uses a sweep-line over per-timestamp windows.
    """
    if not tool_calls:
        return 0

    # Count tool calls at each distinct timestamp
    from collections import Counter

    ts_counts: Counter[datetime] = Counter()
    for tc in tool_calls:
        ts_counts[tc.timestamp] += 1

    # The peak concurrent count is the maximum calls sharing a timestamp
    return max(ts_counts.values()) if ts_counts else 0


def _find_max_concurrent_agents(
    agent_events: list[tuple[str, datetime]],
) -> int:
    """Find the maximum number of concurrently active agents.

    Uses a sweep-line algorithm over agent time ranges.
    For each agent, compute [first_timestamp, last_timestamp].
    Then sweep to find peak overlap.
    """
    if not agent_events:
        return 0

    # Build time ranges per agent_id
    ranges: dict[str, tuple[datetime, datetime]] = {}
    for agent_id, ts in agent_events:
        if agent_id not in ranges:
            ranges[agent_id] = (ts, ts)
        else:
            current = ranges[agent_id]
            ranges[agent_id] = (min(current[0], ts), max(current[1], ts))

    if len(ranges) <= 1:
        return len(ranges)

    # Sweep line: +1 at start, -1 at end
    events: list[tuple[datetime, int]] = []
    for start, end in ranges.values():
        events.append((start, 1))
        events.append((end, -1))

    events.sort(key=lambda x: (x[0], -x[1]))  # starts before ends at same time

    max_concurrent = 0
    current = 0
    for _, delta in events:
        current += delta
        max_concurrent = max(max_concurrent, current)

    return max_concurrent
