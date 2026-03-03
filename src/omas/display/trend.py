"""Rich terminal trend visualization."""

from __future__ import annotations

from rich.console import Console
from rich.table import Table

from omas.models import SessionMetrics

console = Console()


def render_trend(sessions: list[SessionMetrics], dimension: str = "all"):
    """Render trend visualization using bar charts in terminal."""
    if not sessions:
        console.print("[yellow]No sessions for trend analysis.[/yellow]")
        return

    # Sort by timestamp
    sorted_sessions = sorted(
        [s for s in sessions if s.timestamp],
        key=lambda s: s.timestamp,
    )

    if not sorted_sessions:
        console.print("[yellow]No timestamped sessions.[/yellow]")
        return

    console.print()
    console.print("[bold]Trend Analysis[/bold]")
    console.print()

    table = Table(title="Performance Over Time")
    table.add_column("#", justify="right", style="dim")
    table.add_column("Date")
    table.add_column("Project", max_width=20)
    table.add_column("Type")

    if dimension in ("all", "more"):
        table.add_column("More", justify="left", style="cyan")
    if dimension in ("all", "longer"):
        table.add_column("Longer", justify="left", style="green")
    if dimension in ("all", "thicker"):
        table.add_column("Thicker", justify="left", style="red")
    if dimension in ("all", "fewer"):
        table.add_column("Fewer", justify="left", style="yellow")

    table.add_column("Score", justify="right")

    for i, s in enumerate(sorted_sessions, 1):
        date_str = s.timestamp.strftime("%m/%d") if s.timestamp else "?"
        project = s.project_path.split("/")[-1] if s.project_path else "?"

        row = [str(i), date_str, project, s.thread_type.value]

        if dimension in ("all", "more"):
            row.append(_bar(s.parallelism.p_thread_score, 10))
        if dimension in ("all", "longer"):
            row.append(_bar(min(s.autonomy.l_thread_score / 10, 10), 10))
        if dimension in ("all", "thicker"):
            row.append(_bar(min(s.density.b_thread_score / 5, 10), 10))
        if dimension in ("all", "fewer"):
            row.append(_bar(s.trust.autonomous_tool_call_pct / 10, 10))

        row.append(f"{s.overall_score:.2f}")
        table.add_row(*row)

    console.print(table)

    # Trend arrows
    if len(sorted_sessions) >= 2:
        first_half = sorted_sessions[: len(sorted_sessions) // 2]
        second_half = sorted_sessions[len(sorted_sessions) // 2 :]

        avg_first = sum(s.overall_score for s in first_half) / len(first_half)
        avg_second = sum(s.overall_score for s in second_half) / len(second_half)

        if avg_second > avg_first * 1.1:
            trend = "[green]Improving[/green]"
        elif avg_second < avg_first * 0.9:
            trend = "[red]Declining[/red]"
        else:
            trend = "[yellow]Stable[/yellow]"

        console.print(f"\nOverall Trend: {trend} ({avg_first:.2f} -> {avg_second:.2f})")
    console.print()


def _bar(value: float, max_val: float, width: int = 10) -> str:
    """Create a small bar chart string."""
    normalized = min(value / max(max_val, 0.01), 1.0)
    filled = int(normalized * width)
    empty = width - filled
    return "█" * filled + "░" * empty
