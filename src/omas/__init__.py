"""Oh My Agentic Score - Measure agentic coding performance using Thread-Based Engineering framework."""

from importlib.metadata import version as _pkg_version

try:
    __version__ = _pkg_version("oh-my-agentic-score")
except Exception:
    __version__ = "0.0.0"  # fallback for uninstalled/dev mode
