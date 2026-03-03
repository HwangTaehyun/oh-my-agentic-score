# Configuration

OMAS uses sensible defaults with all configuration defined in `src/omas/config.py`. This page documents all paths, thresholds, and environment variables.

## Data Paths

### Claude Code Paths

| Path | Description |
|------|-------------|
| `~/.claude/` | Claude Code data directory |
| `~/.claude/projects/` | Project session logs (JSONL files) |
| `~/.claude/history.jsonl` | Claude Code command history |

### OMAS Paths

| Path | Description |
|------|-------------|
| `~/.omas/` | OMAS data directory |
| `~/.omas/metrics.db` | SQLite database with all computed metrics |
| `~/.omas/reports/` | Generated report files |
| `~/.omas/upload_queue.json` | Failed upload retry queue |

## Thread Classification Thresholds

These thresholds determine how sessions are classified into thread types. They are evaluated in priority order — the first matching rule wins.

### Z-thread (Zero-touch)

| Constant | Value | Description |
|----------|-------|-------------|
| `Z_THREAD_MAX_HUMAN_MESSAGES` | 1 | Maximum human messages allowed |
| `Z_THREAD_MIN_TOOL_CALLS` | 10 | Minimum tool calls required |

### B-thread (Big)

| Constant | Value | Description |
|----------|-------|-------------|
| `B_THREAD_MIN_DEPTH` | 2 | Minimum sub-agent nesting depth |

### L-thread (Long)

| Constant | Value | Description |
|----------|-------|-------------|
| `L_THREAD_MIN_AUTONOMOUS_MINUTES` | 30.0 | Minimum autonomous stretch in minutes |
| `L_THREAD_MIN_TOOL_CALLS` | 50 | Minimum tool calls required |

### F-thread (Fusion)

| Constant | Value | Description |
|----------|-------|-------------|
| `F_THREAD_MIN_SIMILARITY` | 0.7 | Minimum Jaccard similarity between sub-agent prompts |

### P-thread (Parallel)

| Constant | Value | Description |
|----------|-------|-------------|
| `P_THREAD_MIN_CONCURRENT` | 2 | Minimum concurrent agents |

### C-thread (Chained)

| Constant | Value | Description |
|----------|-------|-------------|
| `C_THREAD_MIN_HUMAN_MESSAGES` | 3 | Minimum human messages |
| `C_THREAD_MIN_TOOLS_PER_GAP` | 3 | Minimum tool calls between each human message pair |

## Fair Comparison Thresholds

Sessions must meet all of these to be included in aggregate scoring:

| Threshold | Value | Description |
|-----------|-------|-------------|
| `session_duration_minutes` | 5 | Minimum session duration |
| `total_tool_calls` | 10 | Minimum tool calls |
| `total_human_messages` | 1 | Minimum human messages |

## Automated Message Filters

OMAS filters out automated/system messages that don't represent actual human input. Messages containing any of these patterns are excluded from human message counts:

```python
AUTOMATED_MESSAGE_PATTERNS = [
    "<observed_from_primary_session>",
    "<local-command-",
    "<system-reminder>",
]
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OMAS_API_URL` | Cloud API base URL | `https://api.omas.dev` |
| `OMAS_DISABLE_CLOUD` | Disable all cloud features when set to `1` | (unset) |

## CLI Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `--claude-dir` | Path to Claude Code data directory | `~/.claude` |
