# Scoring System

OMAS evaluates every Claude Code session across four independent dimensions, each scored on a **0-10 scale** using log-normalized scaling. The four dimensions map directly to IndyDevDan's Thread-Based Engineering framework.

## The Four Dimensions

| Dimension | Name | Thread | What It Measures |
|-----------|------|--------|------------------|
| **More** | Parallelism | P-thread | Concurrent execution paths (sub-agents running simultaneously) |
| **Longer** | Autonomy | L-thread | How long Claude works without human intervention |
| **Thicker** | Density | B-thread | Work density — sub-agent depth, tool calls per minute |
| **Fewer** | Trust | Z-thread | Human checkpoint reduction — more work per human message |

## More (Parallelism Score)

Measures the maximum number of concurrent execution paths.

**Formula:**

```
p_thread_score = max(max_concurrent_agents, peak_parallel_tools)
```

**Algorithm**: Uses a **sweep-line** approach over agent time ranges. For each sub-agent, OMAS computes `[first_timestamp, last_timestamp]`, then sweeps events (+1 at start, -1 at end) to find peak overlap.

**Metrics collected:**

| Metric | Description |
|--------|-------------|
| `max_concurrent_agents` | Peak agent overlap via sweep-line |
| `total_sub_agents` | Total sub-agents spawned |
| `peak_parallel_tools` | Max parallel tool calls in a single message |

## Longer (Autonomy Score)

Measures how long Claude runs without human intervention, using **activity-based** measurement.

**Formula:**

```
l_thread_score = min(log1p(longest_autonomous_stretch_minutes) * 2.0, 10.0)
```

**Score reference:**

| Minutes | Score |
|---------|-------|
| 0 | 0.0 |
| 1 | 1.4 |
| 5 | 3.6 |
| 10 | 4.8 |
| 20 | 6.1 |
| 30 | 6.9 |
| 60 | 8.2 |
| 120 | 9.6 |
| 200+ | ~10.0 |

**Key insight**: OMAS measures from a human message to Claude's **last activity** (tool call / assistant message) before the next human message — not to the next human message itself. This avoids inflating the time when the user goes idle while Claude has already stopped working.

**Metrics collected:**

| Metric | Description |
|--------|-------------|
| `longest_autonomous_stretch_minutes` | Longest gap of Claude-only activity |
| `max_tool_calls_between_human` | Most tool calls in a single autonomous stretch |
| `max_consecutive_assistant_turns` | Longest run of assistant messages |

## Thicker (Density Score)

Measures work density — how much is accomplished per unit time, and the depth of sub-agent nesting.

**Formula:**

```
b_thread_score = total_sub_agents * max(1, max_sub_agent_depth)
```

**Depth levels:**

| Depth | Meaning |
|-------|---------|
| 0 | No sub-agents |
| 1 | Has sub-agents, none spawn their own |
| 2+ | Sub-agents spawning sub-agents (true B-thread) |

**Metrics collected:**

| Metric | Description |
|--------|-------------|
| `tool_calls_per_minute` | Work throughput rate |
| `tokens_per_minute` | Token throughput rate |
| `max_sub_agent_depth` | Deepest nesting level |
| `total_tool_calls` | Raw tool call count |

## Fewer (Trust Score)

Measures how few human checkpoints Claude needs to do substantial work. Higher score means more autonomous work per human interaction.

**Formula:**

```
ratio_score = min(log1p(tool_calls_per_human_message) * 2.0, 10.0)
z_thread_score = max(ratio_score - ask_penalty, 0.0)
```

**Score reference:**

| Tools/Human | Score |
|-------------|-------|
| 1 | 1.4 |
| 5 | 3.6 |
| 10 | 4.8 |
| 20 | 6.1 |
| 50 | 7.9 |
| 100 | 9.2 |
| 150+ | ~10.0 |

**AskUserQuestion penalty**: If Claude uses `AskUserQuestion` tool calls, a penalty of up to 3 points is applied: `penalty = min((ask_count / total_tool_calls) * 10.0, 3.0)`.

**Metrics collected:**

| Metric | Description |
|--------|-------------|
| `tool_calls_per_human_message` | Primary autonomy ratio |
| `assistant_per_human_ratio` | Assistant messages per human message |
| `ask_user_count` | AskUserQuestion tool call count |
| `autonomous_tool_call_pct` | Percentage of non-ask tool calls |

## Overall Score

The overall score is the average of four normalized dimension scores, each contributing 25%:

```
p_norm = min(p_thread_score, 10.0)
l_norm = min(log1p(l_thread_score) * 2.0, 10.0)
b_norm = min(log1p(b_thread_score) * 2.0, 10.0)
f_norm = min(autonomous_tool_call_pct / 10.0, 10.0)

overall = (p_norm + l_norm + b_norm + f_norm) / 4.0
```

## Score Ranges

| Range | Level | Description |
|-------|-------|-------------|
| 0-2 | Beginner | Basic conversations, minimal agent usage |
| 2-4 | Developing | Starting to use parallel agents and longer sessions |
| 4-6 | Intermediate | Regular use of sub-agents, decent autonomy |
| 6-8 | Advanced | Deep agent hierarchies, long autonomous stretches |
| 8-10 | Expert | Near-zero-touch, maximum parallelism and trust |
