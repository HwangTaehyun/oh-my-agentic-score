# Getting Started

Oh My Agentic Score (OMAS) analyzes your [Claude Code](https://docs.anthropic.com/en/docs/claude-code) session logs and measures agentic performance across four dimensions. Based on [IndyDevDan](https://www.youtube.com/@indydevdan)'s Thread-Based Engineering framework.

## Prerequisites

- **Python 3.11+**
- **Claude Code** installed and used (OMAS reads session logs from `~/.claude/projects/`)
- **Node.js 18+** (optional, for the interactive dashboard)

## Installation

### Using pip

```bash
pip install oh-my-agentic-score
```

### Using uv (recommended)

```bash
uv tool install oh-my-agentic-score
```

### From source

```bash
git clone https://github.com/HwangTaehyun/oh-my-agentic-score.git
cd oh-my-agentic-score
uv sync
uv run omas --help
```

## First Run

### 1. Scan your sessions

Parse all Claude Code session logs and compute metrics:

```bash
omas scan
```

This reads JSONL files from `~/.claude/projects/`, computes four dimension scores for each session, classifies thread types, and stores results in a local SQLite database at `~/.omas/metrics.db`.

### 2. View your report

```bash
omas report
```

Outputs a Rich-formatted terminal report showing per-session scores, thread type distribution, and fair comparison metrics.

### 3. Launch the dashboard

```bash
omas dashboard
```

Exports metrics to JSON and starts the Next.js dashboard with radar charts, trend lines, and per-project breakdowns.

## What's Next?

- Learn about the [Scoring System](/guide/scoring) to understand what each dimension measures
- Explore the [7 Thread Types](/guide/thread-types) and how sessions are classified
- See all available [CLI Commands](/guide/cli-commands)
- Check the [Fair Comparison](/guide/fair-comparison) system for aggregate scoring
