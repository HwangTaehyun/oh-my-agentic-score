"""Rich terminal report for multiple sessions."""

from __future__ import annotations

from collections import Counter

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from omas.models import SessionMetrics, ThreadType

console = Console()


def render_report(sessions: list[SessionMetrics], title: str = "Thread Metrics Report"):
    """Render a summary report across all sessions."""
    if not sessions:
        console.print("[yellow]No sessions found.[/yellow]")
        return

    console.print()
    console.print(f"[bold]{title}[/bold]")
    console.print(f"Total sessions: {len(sessions)}")
    console.print()

    # Thread type distribution
    type_counts = Counter(s.thread_type.value for s in sessions)
    type_table = Table(title="Thread Type Distribution")
    type_table.add_column("Type", style="bold")
    type_table.add_column("Count", justify="right")
    type_table.add_column("Percentage", justify="right")

    for thread_type in ThreadType:
        count = type_counts.get(thread_type.value, 0)
        pct = count / len(sessions) * 100 if sessions else 0
        type_table.add_row(thread_type.value, str(count), f"{pct:.1f}%")

    console.print(type_table)
    console.print()

    # Session table
    session_table = Table(title="Sessions")
    session_table.add_column("#", justify="right", style="dim")
    session_table.add_column("Date")
    session_table.add_column("Project", max_width=30)
    session_table.add_column("Type", style="bold")
    session_table.add_column("Duration", justify="right")
    session_table.add_column("Tools", justify="right")
    session_table.add_column("Human", justify="right")
    session_table.add_column("More", justify="right", style="cyan")
    session_table.add_column("Longer", justify="right", style="green")
    session_table.add_column("Thicker", justify="right", style="red")
    session_table.add_column("Fewer", justify="right", style="yellow")
    session_table.add_column("Score", justify="right", style="bold")

    for i, s in enumerate(sessions, 1):
        date_str = s.timestamp.strftime("%Y-%m-%d %H:%M") if s.timestamp else "N/A"
        project = s.project_path.split("/")[-1] if s.project_path else "N/A"

        session_table.add_row(
            str(i),
            date_str,
            project,
            s.thread_type.value,
            f"{s.session_duration_minutes:.0f}m",
            str(s.total_tool_calls),
            str(s.total_human_messages),
            f"{s.parallelism.p_thread_score:.1f}",
            f"{s.autonomy.l_thread_score:.1f}",
            f"{s.density.b_thread_score:.1f}",
            f"{s.trust.autonomous_tool_call_pct:.0f}%",
            f"{s.overall_score:.2f}",
        )

    console.print(session_table)
    console.print()

    # Averages — uses weighted average (same formula as Cloud leaderboard)
    if sessions:
        from omas.metrics.qualifier import is_qualified, session_weight

        avg_score = sum(s.overall_score for s in sessions) / len(sessions)
        avg_tools = sum(s.total_tool_calls for s in sessions) / len(sessions)
        avg_duration = sum(s.session_duration_minutes for s in sessions) / len(sessions)

        qualified = [s for s in sessions if is_qualified(s)]
        if qualified:
            total_weight = sum(session_weight(s) for s in qualified)
            weighted_avg = (
                sum(s.overall_score * session_weight(s) for s in qualified) / total_weight
                if total_weight > 0
                else 0.0
            )
        else:
            weighted_avg = avg_score

        console.print(
            Panel(
                f"Score: {weighted_avg:.2f} (weighted, = Cloud) | "
                f"Simple Avg: {avg_score:.2f} | "
                f"Qualified: {len(qualified)}/{len(sessions)}\n"
                f"Avg Tool Calls: {avg_tools:.0f} | "
                f"Avg Duration: {avg_duration:.0f} min",
                title="[bold]Averages[/bold]",
            )
        )
