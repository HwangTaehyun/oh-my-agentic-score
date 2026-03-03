"""Rich terminal dashboard for single session analysis."""

from __future__ import annotations

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from omas.models import SessionMetrics, ThreadType

console = Console()

THREAD_COLORS = {
    ThreadType.BASE: "white",
    ThreadType.P: "cyan",
    ThreadType.C: "yellow",
    ThreadType.F: "magenta",
    ThreadType.B: "red",
    ThreadType.L: "green",
    ThreadType.Z: "bold green",
}


def render_session_dashboard(metrics: SessionMetrics):
    """Render a Rich dashboard for a single session."""
    color = THREAD_COLORS.get(metrics.thread_type, "white")
    _render_header(metrics, color)
    _render_dimensions(metrics)
    _render_overall_score(metrics)


def _render_header(metrics: SessionMetrics, color: str):
    """Render the session header panel."""
    console.print()
    console.print(
        Panel(
            f"[bold]{metrics.thread_type.value}[/bold] | "
            f"Duration: {metrics.session_duration_minutes:.1f} min | "
            f"Tool Calls: {metrics.total_tool_calls} | "
            f"Human Messages: {metrics.total_human_messages} | "
            f"Model: {metrics.model}",
            title=f"[bold]Session: {metrics.session_id[:8]}...[/bold]",
            subtitle=f"[dim]{metrics.project_path}[/dim]",
            border_style=color,
        )
    )


def _render_dimensions(metrics: SessionMetrics):
    """Render the four dimension panels in a 2x2 grid."""
    table = Table(show_header=False, expand=True, box=None, padding=(0, 1))
    table.add_column(ratio=1)
    table.add_column(ratio=1)

    m, a, d, t = metrics.parallelism, metrics.autonomy, metrics.density, metrics.trust
    table.add_row(
        _make_dimension_panel("MORE (Parallelism)", "cyan", [
            ("Concurrent Agents", str(m.max_concurrent_agents)),
            ("Total Sub-agents", str(m.total_sub_agents)),
            ("Peak Parallel Tools", str(m.peak_parallel_tools)),
            ("P-score", f"{m.p_thread_score:.1f}"),
        ]),
        _make_dimension_panel("LONGER (Autonomy)", "green", [
            ("Autonomous Stretch", f"{a.longest_autonomous_stretch_minutes:.1f} min"),
            ("Max Tools Between Human", str(a.max_tool_calls_between_human)),
            ("Session Duration", f"{a.session_duration_minutes:.1f} min"),
            ("L-score", f"{a.l_thread_score:.1f}"),
        ]),
    )
    table.add_row(
        _make_dimension_panel("THICKER (Density)", "red", [
            ("Tool Calls/min", f"{d.tool_calls_per_minute:.1f}"),
            ("Total Tool Calls", str(d.total_tool_calls)),
            ("Sub-agent Depth", str(d.max_sub_agent_depth)),
            ("Tokens/min", f"{d.tokens_per_minute:.0f}"),
            ("B-score", f"{d.b_thread_score:.1f}"),
        ]),
        _make_dimension_panel("FEWER (Trust)", "yellow", [
            ("Tools/Human Msg", f"{t.tool_calls_per_human_message:.1f}"),
            ("Asst/Human Ratio", f"{t.assistant_per_human_ratio:.1f}"),
            ("Ask User Count", str(t.ask_user_count)),
            ("Autonomous %", f"{t.autonomous_tool_call_pct:.1f}%"),
            ("Z-score", f"{t.z_thread_score:.1f}"),
        ]),
    )
    console.print(table)


def _render_overall_score(metrics: SessionMetrics):
    """Render the overall score bar."""
    score_bar = _make_score_bar(metrics.overall_score)
    console.print(
        Panel(
            f"Overall Score: {score_bar} {metrics.overall_score:.2f}/10",
            border_style="bold",
        )
    )
    console.print()


def _make_dimension_panel(title: str, color: str, items: list[tuple[str, str]]) -> Panel:
    """Create a Rich panel for a single dimension."""
    lines = []
    for label, value in items:
        lines.append(f"  [{color}]{label}:[/{color}] {value}")
    content = "\n".join(lines)
    return Panel(content, title=f"[bold {color}]{title}[/bold {color}]", border_style=color)


def _make_score_bar(score: float, width: int = 20) -> str:
    """Create a text-based progress bar for score."""
    filled = int(score / 10.0 * width)
    empty = width - filled
    return f"[green]{'█' * filled}[/green][dim]{'░' * empty}[/dim]"
