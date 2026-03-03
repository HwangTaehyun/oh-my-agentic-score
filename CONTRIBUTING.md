# Contributing to Oh My Agentic Score

Thank you for your interest in contributing to OMAS! This guide will help you get started.

## Development Setup

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip
- Node.js 18+ (for the dashboard)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/HwangTaehyun/oh-my-agentic-score.git
cd oh-my-agentic-score

# Install Python dependencies
uv sync

# Verify the CLI works
uv run omas --help

# Install dashboard dependencies
cd dashboard && npm install && cd ..
```

### Running Tests

```bash
uv run pytest
uv run pytest --cov=omas
```

### Running the Dashboard

```bash
# First, scan and export data
uv run omas scan
uv run omas export

# Then start the dashboard
cd dashboard && npm run dev
```

## Project Structure

```
oh-my-agentic-score/
├── src/omas/                # Python CLI package
│   ├── cli.py               # Click CLI entry point
│   ├── models.py            # Pydantic data models
│   ├── config.py            # Configuration constants
│   ├── classifier/          # Thread type classification
│   ├── metrics/             # 4-dimension metric computation
│   ├── parser/              # JSONL session parsing
│   ├── storage/             # SQLite persistence
│   ├── display/             # Rich terminal output
│   ├── tui/                 # Textual TUI screens
│   └── cloud/               # Cloud auth & upload
├── dashboard/               # Next.js 15 frontend
│   ├── app/                 # App router pages
│   ├── components/          # React components
│   └── lib/                 # TypeScript utilities
├── docs/                    # VitePress documentation
└── tests/                   # Test suite
```

## How to Contribute

### Reporting Bugs

1. Check existing issues first
2. Include your Python version, OS, and Claude Code version
3. Provide steps to reproduce
4. Include relevant error output

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the use case and expected behavior
3. Consider how it fits with the Thread-Based Engineering framework

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Add tests if applicable
5. Run tests: `uv run pytest`
6. Commit with a clear message
7. Push and create a PR

### Code Style

- Python: Follow existing patterns (Pydantic models, Click CLI)
- TypeScript: Follow existing Next.js patterns
- Use type hints in Python
- Keep functions focused and well-documented

### Commit Messages

Use clear, descriptive commit messages:

```
Add session weight calculation for fair comparison

- Implement log-scaled weight based on tool calls and duration
- Add consistency score using rolling standard deviation
- Update report command to show comparison metrics
```

## Architecture Decisions

### Thread-Based Engineering Framework

This project is based on [IndyDevDan](https://www.youtube.com/@indydevdan)'s Thread-Based Engineering framework with four dimensions:

| Dimension | Thread | Measures |
|-----------|--------|----------|
| More      | P-thread | Parallel execution paths |
| Longer    | L-thread | Autonomous work duration |
| Thicker   | B-thread | Work density per time unit |
| Fewer     | Z-thread | Human checkpoint reduction |

### Offline-First

The CLI always stores data locally first (SQLite). Cloud upload is optional and background. The tool must work perfectly without any network access.

### Privacy

Project paths are hashed before any cloud upload. No source code or file contents are ever transmitted.

## Questions?

Open an issue or start a discussion on GitHub. We're happy to help!
