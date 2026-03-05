# Scoring System

OMAS evaluates every Claude Code session across four independent dimensions, each scored on a **0-10 scale** using log-normalized scaling. The four dimensions map directly to IndyDevDan's Thread-Based Engineering framework.

## Why These Dimensions Matter for Agentic Coding

Traditional software engineering measures productivity by lines of code, tickets closed, or hours spent. But **agentic coding** — the skill of collaborating with AI agents — requires entirely different metrics. A developer who can get Claude to autonomously implement an entire feature with a single, well-crafted instruction is fundamentally more productive than one who micro-manages every step.

These four dimensions capture what it means to be good at agentic coding:

- **More (Parallelism)**: Can you orchestrate multiple agents working simultaneously? This is the difference between linear and exponential throughput.
- **Longer (Autonomy)**: Can you give instructions clear enough that Claude works for 30+ minutes without needing clarification? This reflects the quality of your requirements and project documentation.
- **Thicker (Density)**: Can you leverage deep agent hierarchies where agents spawn sub-agents? This unlocks complex architectural work that would be impossible with a single thread.
- **Fewer (Trust)**: Can you reduce the number of human checkpoints while maintaining quality? Each interruption breaks Claude's flow and slows down the overall process.

## The Four Dimensions

| Dimension | Name | Thread | What It Measures |
|-----------|------|--------|------------------|
| **More** | Parallelism | P-thread | Concurrent sessions running simultaneously (cross-session parallelism) |
| **Longer** | Autonomy | L-thread | How long Claude works without human intervention |
| **Thicker** | Density | B-thread | Work density — sub-agent depth, tool calls per minute |
| **Fewer** | Trust | Z-thread | Human checkpoint reduction — more work per human message |

## More (Parallelism Score)

Measures how many Claude Code sessions are running simultaneously.

**Why this matters for agentic coding:** A skilled agentic developer decomposes work into independent streams and runs multiple sessions in parallel. Opening 5 terminals each running Claude Code multiplies throughput — each session works on an independent task, and all progress happens concurrently. This is fundamentally different from sub-agent parallelism within a single session (which is now measured by Thicker).

**Formula:**

```
p_thread_score = min(concurrent_sessions, 10.0)
```

**Algorithm**: Uses a **sweep-line** approach to find the actual peak number of sessions running at any point in time. All sessions across all projects are included. Events (+1 at session start, -1 at session end) are sorted chronologically and swept to build a concurrency timeline. For each session, the peak concurrent count during its active window is recorded. This avoids over-counting from pairwise overlap — e.g., a long session overlapping with 3 short non-concurrent sessions correctly gets peak 2, not 4. This is a direct value, NOT log-scaled.

**Score reference:**

| Sessions | Score |
|----------|-------|
| 1 | 1.0 |
| 2 | 2.0 |
| 3 | 3.0 |
| 5 | 5.0 |
| 10 | 10.0 |

**Key insight**: P-thread is computed during `omas scan` which sees all sessions. `omas analyze` (single session) defaults to P-thread=1.

**Metrics collected:**

| Metric | Description |
|--------|-------------|
| `concurrent_sessions` | Peak concurrent sessions via cross-session sweep-line |

::: tip
`max_concurrent_agents` (within-session agent concurrency) has moved to the Thicker dimension as "orchestration breadth."
:::

## Longer (Autonomy Score)

Measures how long Claude runs without human intervention, using **activity-based** measurement.

**Why this matters for agentic coding:** The ability to let Claude work autonomously for extended periods is the most impactful skill in agentic coding. It requires: (1) well-written project documentation (`CLAUDE.md`) so Claude doesn't need to ask questions, (2) clear and complete requirements given upfront, and (3) trust — resisting the urge to interrupt mid-execution. A 30-minute autonomous stretch produces far more coherent work than thirty 1-minute micro-managed steps.

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
| 148+ | ~10.0 |

**Key insight**: OMAS measures from a human message to Claude's **last activity** (tool call / assistant message) before the next human message — not to the next human message itself. This avoids inflating the time when the user goes idle while Claude has already stopped working.

### Idle Gap Capping (v0.6.0+)

Gaps longer than **30 minutes** (`IDLE_GAP_THRESHOLD`) between consecutive activity timestamps are capped at 30 minutes. This prevents idle periods (e.g., user left a permission prompt unanswered for hours) from inflating the autonomous stretch duration. Without this, a developer who simply forgot to close their terminal overnight would get a perfect autonomy score — that's not agentic skill, it's an accident.

**Example:**

```
Tool(10:00) → Tool(10:05) → [3-hour idle] → Tool(13:05) → Tool(13:10)
Without capping: stretch = 190 min → score ≈ 10.0 (inflated!)
With capping:    stretch = 5 + 30(capped) + 5 = 40 min → score = 7.4
```

**Metrics collected:**

| Metric | Description |
|--------|-------------|
| `longest_autonomous_stretch_minutes` | Longest gap of Claude-only activity (idle gaps capped at 30min) |
| `max_tool_calls_between_human` | Most tool calls in a single autonomous stretch |
| `max_consecutive_assistant_turns` | Longest run of assistant messages |

## Thicker (Density Score)

Measures work density — how much is accomplished per unit time, and the depth of sub-agent nesting.

**Why this matters for agentic coding:** Sub-agent depth reflects architectural thinking. When you can instruct Claude to "organize a team" and it creates agents that themselves create specialized sub-agents (analysis → implementation → testing → review), you've unlocked a level of automation that mirrors real engineering organizations. Flat, single-threaded work is Base-level; deep, nested hierarchies are expert-level.

**Formula:**

```
raw = total_sub_agents * max(1, max_sub_agent_depth) + max(0, max_concurrent_agents - 1)
b_thread_score = min(log1p(raw) * 3.0, 10.0)
```

The final term, `max(0, max_concurrent_agents - 1)`, is the **orchestration breadth**. Within-session concurrent agent count (previously measured by P-thread) is now factored into B-thread as orchestration breadth. If a session has 5 agents running concurrently, that adds 4 to the raw score before log-scaling.

**Depth levels:**

| Depth | Meaning |
|-------|---------|
| 0 | No sub-agents |
| 1 | Has sub-agents, none spawn their own |
| 2+ | Sub-agents spawning sub-agents (true B-thread) |

### AI Written Lines Bonus

OMAS counts the number of lines written by AI through code-writing tools and adds a small bonus to the density score.

**Formula:**

```
line_bonus = min(ai_written_lines / 50000, 1.0)
b_norm = min(b_thread_score + line_bonus, 10.0)
```

**How lines are counted:**

| Tool | Field | Counting |
|------|-------|----------|
| `Write` | `input.content` | `len(content.splitlines())` |
| `Edit` | `input.new_string` | `len(new_string.splitlines())` |
| `MultiEdit` | `input.edits[].new_string` | `sum(len(e.new_string.splitlines()))` |

**Bonus reference:**

| AI Written Lines | Bonus |
|-----------------|-------|
| 0 | +0.0 |
| 1,000 | +0.02 |
| 5,000 | +0.10 |
| 10,000 | +0.20 |
| 50,000+ | +1.0 (capped) |

This is measured **per session**, not cumulative. Typical sessions earn +0.0~0.2 bonus. The maximum impact on overall score is +0.25 (since 4 dimensions are averaged).

**Metrics collected:**

| Metric | Description |
|--------|-------------|
| `tool_calls_per_minute` | Work throughput rate |
| `tokens_per_minute` | Token throughput rate |
| `max_sub_agent_depth` | Deepest nesting level |
| `max_concurrent_agents` | Peak concurrent agents within session (orchestration breadth) |
| `total_tool_calls` | Raw tool call count |
| `ai_written_lines` | Total lines written by AI via Write/Edit/MultiEdit tools |
| `ai_line_bonus` | Density bonus from AI-written lines (max +1.0) |

## Fewer (Trust Score)

Measures how few human checkpoints Claude needs to do substantial work. Higher score means more autonomous work per human interaction.

**Why this matters for agentic coding:** This is the **ratio** of work-per-intervention, not the absolute amount of work (that's Thicker/Longer's job). A developer who gives one clear instruction and gets 100 tool calls of autonomous work demonstrates far better agentic skill than one who gives 50 instructions for 100 tool calls. The key insight: Fewer measures the **quality of your instructions and trust relationship** with the AI. Volume penalty was intentionally removed — even 20 tool calls from 1 human message (ratio 20:1) is excellent agentic coding.

**Formula:**

```
effective_human = human_messages - trivial_delegations   # min 1
ratio_score = min(log1p(tool_calls / effective_human) * 2.0, 10.0)
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

### Trivial Delegation Filter

Not all human messages represent meaningful checkpoints. Short commands like "run tests" or "build it" that trigger only a few tool calls are **trivial delegations** — the user is just delegating a quick task, not actually intervening in the AI's work. Without this filter, a developer who says "run tests" between major autonomous stretches would be unfairly penalized as if they were micro-managing. In reality, they're simply issuing convenience commands while letting the AI do the heavy lifting.

**How it works:**

1. Sort human messages by timestamp
2. Count tool calls between each consecutive pair of human messages
3. If a segment has **≤ 5 tool calls** (configurable via `TRIVIAL_DELEGATION_THRESHOLD`), that human message is classified as trivial
4. `effective_human_count = human_messages - trivial_delegations` (minimum 1)

**Example:**

| Human Message | Tool Calls After | Classification |
|--------------|------------------|----------------|
| "Run tests" | 1 | Trivial (≤5) |
| "Build it" | 2 | Trivial (≤5) |
| "Implement the auth module" | 40 | Real work |

- **Without filter**: `43 / 3 = 14.3` → score 5.5
- **With filter**: `43 / 1 = 43` → score 7.5 (trivial delegations excluded)

### AskUserQuestion Penalty (v0.6.0+)

`AskUserQuestion` calls are split into two categories:

- **Inside Plan Mode** (between `EnterPlanMode` and `ExitPlanMode`): **No penalty**. Asking clarifying questions during planning is good practice — it's the equivalent of a tech lead gathering requirements before sprint. Better planning leads to longer, uninterrupted autonomous execution.
- **Outside Plan Mode** (during implementation): Penalty applies. Asking the user mid-implementation signals that instructions weren't clear enough or the AI lacks confidence. In agentic coding, the goal is "plan thoroughly, then execute autonomously."

```
penalized_ask_ratio = penalized_ask_count / total_tool_calls
ask_penalty = min(penalized_ask_ratio * 10.0, 3.0)   # max -3 pts
```

::: tip
The Fewer dimension measures **ratio only** (tool calls per human message). There is no volume penalty — absolute tool count is measured by the Thicker and Longer dimensions.
:::

**Metrics collected:**

| Metric | Description |
|--------|-------------|
| `tool_calls_per_human_message` | Tool calls per effective human message (excludes trivial delegations) |
| `effective_human_count` | Human messages actually used in trust ratio |
| `trivial_delegation_count` | Human messages classified as trivial delegation (≤5 tool calls) |
| `assistant_per_human_ratio` | Assistant messages per human message |
| `ask_user_count` | Total AskUserQuestion calls (including plan mode) |
| `plan_mode_ask_user_count` | AskUserQuestion inside Plan Mode (no penalty) |
| `penalized_ask_user_count` | AskUserQuestion outside Plan Mode (penalized) |
| `autonomous_tool_call_pct` | Percentage of non-penalized-ask tool calls |

## Overall Score

The overall score is the simple average of the four dimension scores, each contributing 25%. Each `*_thread_score` is already on a 0-10 scale — no additional normalization is applied.

```
p_norm = min(p_thread_score, 10.0)                          # direct value
l_norm = min(l_thread_score, 10.0)                          # already log-scaled
b_norm = min(b_thread_score + ai_line_bonus, 10.0)          # with AI lines bonus
f_norm = min(z_thread_score, 10.0)                          # already log-scaled

overall = (p_norm + l_norm + b_norm + f_norm) / 4.0
```

## Human Message Detection (v0.6.0+)

OMAS distinguishes genuine human messages from automated/system messages. Only real human input counts toward scoring. This is critical because Claude Code injects many system messages into the JSONL logs (git status, hook outputs, session continuations) — without filtering, these would falsely inflate the human message count and deflate the Fewer score.

**Why accurate detection matters:** If system-injected messages are counted as human messages, the tool-calls-per-human ratio drops dramatically. A session where the user typed 2 instructions but received 20 system messages would look like 22 human interventions — making even excellent agentic work appear heavily micro-managed.

**Filtering rules:**

1. **Minimum length**: Messages shorter than 3 characters are filtered out (e.g., "y", "ok" — typically permission approvals, not real instructions)
2. **Automated pattern matching**: 24 patterns are checked, including:
   - System reminders (`<system-reminder>`, `<task-notification>`, `<available-deferred-tools>`)
   - Git context (`gitStatus:`, `Current branch:`, `This is the git status at`)
   - Hook feedback (`PreToolUse hook`, `Stop hook`, `Hook feedback:`)
   - Session continuations (`This session is being continued`)
   - IDE context tags (`<ide_*>`, `<command-*>`)
3. **Tool results**: List-format messages containing only `tool_result` items are excluded (these are permission approval responses)
4. **User type**: Only `userType: "external"` messages are considered

## Session Qualifying Gate (v0.6.1+)

Sessions with **zero tool calls** are skipped during scan. These represent conversations where Claude responded with text only (no file reads, edits, or commands) — not agentic work. A pure text Q&A session doesn't demonstrate any agentic coding skill, so including it would dilute aggregate scores.

## Score Ranges

| Range | Level | Description |
|-------|-------|-------------|
| 0-2 | Beginner | Basic conversations, minimal agent usage |
| 2-4 | Developing | Starting to use parallel agents and longer sessions |
| 4-6 | Intermediate | Regular use of sub-agents, decent autonomy |
| 6-8 | Advanced | Deep agent hierarchies, long autonomous stretches |
| 8-10 | Expert | Near-zero-touch, maximum parallelism and trust |
