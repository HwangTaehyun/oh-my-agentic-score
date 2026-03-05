# Thread Types

Every Claude Code session is classified into one of seven thread types. Classification follows a **priority-based** evaluation — the first matching rule wins, from most specific to least.

## The Seven Types

| Priority | Type | Name | Description |
|----------|------|------|-------------|
| 1 | **Z-thread** | Zero-touch | Minimal human input, maximum autonomous work |
| 2 | **B-thread** | Big | Nested sub-agents (agents spawning agents) |
| 3 | **L-thread** | Long | Extended autonomous stretch with high tool usage |
| 4 | **F-thread** | Fusion | Similar tasks distributed to multiple agents |
| 5 | **P-thread** | Parallel | 2+ concurrent agent execution paths |
| 6 | **C-thread** | Chained | Multiple human checkpoints with work between each |
| 7 | **Base** | Default | Standard conversation |

## Classification Rules

### Z-thread (Zero-touch)

```
human_messages <= 1 AND total_tool_calls >= 10
```

The holy grail of agentic coding. You give one command, Claude handles everything autonomously. Requires significant work output (10+ tool calls) to avoid classifying trivial one-shot queries.

### B-thread (Big)

```
max_sub_agent_depth >= 2
```

Agents spawning agents. The primary agent delegates tasks to sub-agents, and those sub-agents spawn their own sub-agents. This indicates deep, hierarchical task decomposition.

### L-thread (Long)

```
longest_autonomous_stretch >= 30 minutes AND total_tool_calls >= 50
```

Claude works for 30+ minutes without human intervention, executing 50+ tool calls. These are deep, focused work sessions where Claude has enough context and permissions to make sustained progress.

### F-thread (Fusion)

```
2+ sub-agents with Jaccard word similarity >= 0.7 in their prompts
```

Multiple agents receive substantially similar prompts — a pattern of distributing related tasks across parallel workers. OMAS detects this using Jaccard similarity on sub-agent prompt text.

### P-thread (Parallel)

```
concurrent_sessions >= 2
```

Two or more Claude Code sessions running simultaneously (cross-session). Detected using the sweep-line algorithm across all session time ranges to find peak concurrent count.

### C-thread (Chained)

```
human_messages >= 3 AND each gap between human messages has >= 3 tool calls
```

A conversational pattern with multiple human checkpoints, but with meaningful work between each. This represents iterative development with human review at each stage.

### Base

```
(default — no other rule matched)
```

Standard Claude Code conversation without significant agentic patterns.

## Evolution Roadmap

Progressing through thread types represents increasing mastery of agentic coding:

```
Base → C-thread    Use 3+ conversation turns with work between each
C    → P-thread    Request parallel tasks ("analyze these 3 files simultaneously")
P    → L-thread    Give detailed instructions, let Claude work 30+ minutes
L    → B-thread    Use teams/worktrees for deep sub-agent hierarchies
B    → Z-thread    One command, full feature implementation, auto-approve
```

## Tips for Advancing

| Transition | Strategy |
|------------|----------|
| Base → C | Have multi-turn conversations with real work in between |
| C → P | Ask Claude to work on multiple things simultaneously |
| P → L | Write a detailed `CLAUDE.md`, give complete requirements upfront |
| L → B | Use the Agent tool, teams, and worktrees for hierarchical work |
| B → Z | Enable auto-approve, provide comprehensive instructions in one prompt |

## Threshold Configuration

All classification thresholds are defined in `src/omas/config.py` and can be viewed in the [Configuration Reference](/reference/configuration).
