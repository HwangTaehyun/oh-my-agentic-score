"""Configuration constants and threshold defaults."""

from pathlib import Path

# Claude Code data paths
CLAUDE_DIR = Path.home() / ".claude"
CLAUDE_PROJECTS_DIR = CLAUDE_DIR / "projects"
CLAUDE_HISTORY_FILE = CLAUDE_DIR / "history.jsonl"

# OMAS storage paths
OMAS_DIR = Path.home() / ".omas"
SQLITE_DB_PATH = OMAS_DIR / "metrics.db"
REPORTS_DIR = OMAS_DIR / "reports"
UPLOAD_QUEUE_PATH = OMAS_DIR / "upload_queue.json"

# Thread classification thresholds
Z_THREAD_MAX_HUMAN_MESSAGES = 1
Z_THREAD_MIN_TOOL_CALLS = 10

B_THREAD_MIN_DEPTH = 2

L_THREAD_MIN_AUTONOMOUS_MINUTES = 30.0
L_THREAD_MIN_TOOL_CALLS = 50

F_THREAD_MIN_SIMILARITY = 0.7

P_THREAD_MIN_CONCURRENT = 2

C_THREAD_MIN_HUMAN_MESSAGES = 3
C_THREAD_MIN_TOOLS_PER_GAP = 3

# Automated message filters (content patterns that indicate non-human messages)
AUTOMATED_MESSAGE_PATTERNS = [
    "<observed_from_primary_session>",
    "<local-command-",
    "<system-reminder>",
]
