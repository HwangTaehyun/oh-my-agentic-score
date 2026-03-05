<p align="center">
  <h1 align="center">Oh My Agentic Score</h1>
  <p align="center">
    <strong>Measure and visualize your agentic coding performance</strong>
  </p>
  <p align="center">
    Based on <a href="https://www.youtube.com/@indydevdan">IndyDevDan</a>'s Thread-Based Engineering framework
  </p>
  <p align="center">
    <a href="https://pypi.org/project/oh-my-agentic-score/"><img src="https://img.shields.io/pypi/v/oh-my-agentic-score?color=blue" alt="PyPI"></a>
    <a href="https://github.com/HwangTaehyun/oh-my-agentic-score/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/python-3.11+-blue" alt="Python"></a>
    <a href="https://hwangtaehyun.github.io/oh-my-agentic-score/"><img src="https://img.shields.io/badge/docs-VitePress-646CFF" alt="Docs"></a>
  </p>
</p>

---

> *"If you can't measure it, you can't improve it."*

In the age of AI-assisted development, **agentic coding** — the ability to collaborate effectively with AI agents — is becoming an essential skill for every developer. But how do you know if you're actually getting better at it? **You can't improve what you can't measure.**

**Oh My Agentic Score (OMAS)** was born from this belief. Inspired by [IndyDevDan](https://www.youtube.com/@indydevdan)'s brilliant [Thread-Based Engineering](https://www.youtube.com/@indydevdan) framework, this project provides a concrete, data-driven way to measure and visualize your agentic coding performance.

OMAS analyzes your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) session logs and scores your performance across four dimensions: **parallelism**, **autonomy**, **density**, and **trust**. Track your growth from basic conversations to fully autonomous Z-threads — and push yourself to become a better agentic developer.

## Installation

### One-line install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/HwangTaehyun/oh-my-agentic-score/main/install.sh | bash
```

### Homebrew (macOS)

```bash
brew install HwangTaehyun/tap/oh-my-agentic-score
```

### pip / uv

```bash
pip install oh-my-agentic-score

# or with uv (faster)
uv tool install oh-my-agentic-score
```

## Quick Start

```bash
# Scan all Claude Code sessions
omas scan

# View your report
omas report

# Launch interactive dashboard
omas dashboard
```

## Features

### Four-Dimension Scoring (0-10 scale)

| Dimension | Thread | What It Measures |
|-----------|--------|------------------|
| **More** | P-thread | Concurrent sessions running simultaneously (cross-session parallelism) |
| **Longer** | L-thread | Autonomous work duration without human intervention (idle gaps capped at 30min) |
| **Thicker** | B-thread | Work density (sub-agent depth, orchestration breadth, tool calls per minute, AI-written lines bonus) |
| **Fewer** | Z-thread | Human checkpoint reduction (ratio-only, trivial delegations excluded, Plan Mode AskUser exempt) |

### Seven Thread Types

Sessions are classified into one of seven thread types (highest priority first):

```
Z-thread  Zero-touch    Minimal human input, maximum autonomous work
B-thread  Big           Nested sub-agents (agents spawning agents)
L-thread  Long          30+ minutes autonomous stretch, 50+ tool calls
F-thread  Fusion        Similar tasks distributed to multiple agents
P-thread  Parallel      2+ concurrent agent execution paths
C-thread  Chained       Multiple human checkpoints with work between each
Base      Default       Standard conversation
```

### CLI Commands

```bash
omas scan                    # Scan all sessions, build metrics DB
omas analyze <session-id>    # Analyze a single session
omas report                  # Full report with comparison metrics
omas trend                   # Score trends over time
omas export                  # Export JSON for dashboard
omas dashboard               # Launch Next.js dashboard
omas list                    # List discovered sessions
omas tui                     # Interactive TUI (via Trogon)
omas auth login              # OAuth login (GitHub/Google)
omas auth status             # Check auth status
omas upload --dry-run        # Preview cloud upload
```

### Next.js Dashboard

Interactive web dashboard with:
- Radar chart across all 4 dimensions
- Thread type distribution pie chart
- Score trends over time
- Per-project breakdown
- Session detail views

### Fair Comparison System

To prevent short test sessions from skewing scores:

- **Minimum Thresholds**: Sessions must have 5+ min duration, 10+ tool calls, 1+ human messages
- **Weighted Scoring**: Longer, more complex sessions get proportionally more weight
- **Consistency Score**: Measures score stability across recent sessions
- **Composite Rank**: `weighted_score * 0.8 + consistency * 0.2`

### Textual TUI

Interactive terminal UI powered by [Textual](https://textual.textualize.io/) and [Trogon](https://github.com/Textualize/trogon):

```bash
omas tui    # Opens form-based CLI interface
```

## Architecture

```
Claude Code JSONL logs (~/.claude/projects/)
        │
        ▼
   omas scan          Parse & analyze all sessions
        │
        ├─► SQLite DB (~/.omas/metrics.db)     Local storage (always)
        │
        ├─► metrics.json                        Dashboard data
        │
        └─► Cloud upload (optional)             Background sync
             └─► upload_queue.json              Retry queue on failure
```

### Offline-First Design

- Analysis results always save to local SQLite first
- Cloud upload is automatic but optional
- Network failures queue data for retry (max 5 attempts)
- Dashboard works entirely from local data

### Privacy

- Project paths are **hashed** before cloud upload (no directory names exposed)
- Session IDs retained for deduplication only
- **No source code or file contents** are ever transmitted

## How It Works

OMAS parses Claude Code's JSONL session logs from `~/.claude/projects/`. For each session:

1. **Parser** extracts tool calls, user messages, sub-agent events, and token usage
2. **Metrics** compute four independent dimension scores using log-normalized scaling
3. **Classifier** determines the thread type using priority-based rules
4. **Storage** persists to SQLite for historical tracking
5. **Display** renders via Rich terminal UI or Next.js dashboard

### Key Algorithms

- **Cross-session sweep-line** for concurrent session detection (parallelism)
- **Orchestration breadth** for within-session agent concurrency (density)
- **Activity-based** autonomy measurement (measures to Claude's last activity, not next human message)
- **Idle gap capping** at 30 minutes to prevent inflated autonomy scores from idle periods
- **Jaccard similarity** for fusion thread detection
- **Log normalization** (`log1p(x) * 2.0`) for unbounded metrics (0-10 scale)
- **Trivial delegation filter** excludes simple human commands (≤5 tool calls) from trust ratio
- **Plan Mode awareness** exempts AskUserQuestion during planning from penalty
- **Human message filtering** with 24 automated patterns + minimum length (3 chars)

## Improving Your Score

```
Base → C-thread    Use 3+ conversation turns with work between each
C    → P-thread    Request parallel tasks ("analyze these 3 files simultaneously")
P    → L-thread    Give detailed instructions, let Claude work 30+ minutes
L    → B-thread    Use teams/worktrees for deep sub-agent hierarchies
B    → Z-thread    One command, full feature implementation, auto-approve
```

Key tips:
- Write a detailed `CLAUDE.md` with project conventions
- Give complete requirements upfront instead of incremental instructions
- Enable auto-approve for permissions to avoid interruptions
- Use Agent tool for independent parallel work

## Development

```bash
git clone https://github.com/HwangTaehyun/oh-my-agentic-score.git
cd oh-my-agentic-score
uv sync
uv run omas --help
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full development setup.

## Documentation

Full documentation is available at **[hwangtaehyun.github.io/oh-my-agentic-score](https://hwangtaehyun.github.io/oh-my-agentic-score/)**.

## Credits

- **Framework**: [IndyDevDan](https://www.youtube.com/@indydevdan)'s Thread-Based Engineering
- **Inspired by**: [oh-my-opencode](https://github.com/nicepkg/oh-my-opencode)
- **TUI**: [Textual](https://textual.textualize.io/) + [Trogon](https://github.com/Textualize/trogon) by Will McGugan

## Tip

### Be with us!

<a href="https://github.com/HwangTaehyun/oh-my-agentic-score/issues"><img src="https://img.shields.io/badge/Issues-Report%20Bug%20%2F%20Feature%20Request-green" alt="Issues"></a>&nbsp;&nbsp;Found a bug or have a feature idea? Open an issue — all feedback is welcome.

<a href="mailto:thbeem94@gmail.com"><img src="https://img.shields.io/badge/Email-thbeem94%40gmail.com-blue" alt="Email"></a>&nbsp;&nbsp;Reach out directly for questions, suggestions, or collaboration.

<a href="https://github.com/HwangTaehyun"><img src="https://img.shields.io/github/followers/HwangTaehyun?label=Follow%20%40HwangTaehyun&style=social" alt="GitHub Follow"></a>&nbsp;&nbsp;Follow [@HwangTaehyun](https://github.com/HwangTaehyun) on GitHub for more projects.

## License

[MIT](LICENSE) - Taehyun Hwang
