"""CLI entry point for Oh My Agentic Score (omas)."""

from __future__ import annotations

import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.progress import Progress

from omas.config import CLAUDE_DIR
from omas.display.dashboard import render_session_dashboard
from omas.display.report import render_report
from omas.display.trend import render_trend
from omas.metrics.aggregator import compute_session_metrics
from omas.metrics.qualifier import consistency_score as calc_consistency
from omas.metrics.qualifier import is_qualified, session_weight
from omas.models import ComparisonMetrics, ExportData, ProjectSummary, SessionMetrics, ThreadType
from omas.parser.discovery import discover_sessions, find_session_by_id
from omas.parser.session_parser import parse_session
from omas.storage.sqlite_store import MetricsStore

try:
    from trogon import tui
except ImportError:  # trogon is optional
    def tui():  # type: ignore[misc]
        return lambda f: f

console = Console()


@tui()
@click.group()
@click.version_option(package_name="oh-my-agentic-score")
@click.option(
    "--claude-dir",
    type=click.Path(exists=True, path_type=Path),
    default=str(CLAUDE_DIR),
    help="Path to Claude Code data directory (~/.claude)",
)
@click.pass_context
def cli(ctx, claude_dir: Path):
    """Oh My Agentic Score - Measure agentic coding performance."""
    ctx.ensure_object(dict)
    ctx.obj["claude_dir"] = claude_dir


@cli.command()
@click.argument("session_id")
@click.option("--json-output", "output_json", is_flag=True, help="Output as JSON")
@click.pass_context
def analyze(ctx, session_id: str, output_json: bool):
    """Analyze a single session by ID (supports partial IDs)."""
    claude_dir = ctx.obj["claude_dir"]

    session_info = find_session_by_id(session_id, claude_dir=claude_dir)
    if not session_info:
        console.print(f"[red]Session not found: {session_id}[/red]")
        raise SystemExit(1)

    console.print(f"[dim]Parsing session {session_info['session_id']}...[/dim]")

    data = parse_session(
        session_info["jsonl_path"],
        subagent_dir=session_info.get("subagent_dir"),
    )
    data.project_path = session_info["project_path"]
    data.project_hash = session_info["project_hash"]

    metrics = compute_session_metrics(
        data,
        project_path=session_info["project_path"],
        project_hash=session_info["project_hash"],
    )

    # Save to SQLite
    store = MetricsStore()
    store.save_metrics(metrics)

    if output_json:
        console.print_json(metrics.model_dump_json(indent=2))
    else:
        render_session_dashboard(metrics)


@cli.command()
@click.option("--project", help="Filter by project path substring")
@click.option("--since", help="Only sessions after this date (YYYY-MM-DD)")
@click.option("--limit", default=50, help="Max sessions to show")
@click.pass_context
def report(ctx, project: Optional[str], since: Optional[str], limit: int):
    """Generate overall report across all sessions."""
    store = MetricsStore()
    since_dt = _parse_date(since) if since else None

    sessions = store.load_all(project_filter=project, since=since_dt)

    if not sessions:
        console.print("[yellow]No data in database. Run 'omas scan' first.[/yellow]")
        return

    render_report(sessions[:limit])

    # Display comparison metrics
    from rich.panel import Panel

    qualified = [s for s in sessions if is_qualified(s)]
    excluded = len(sessions) - len(qualified)
    if qualified:
        total_weight = sum(session_weight(s) for s in qualified)
        weighted_score = (
            sum(s.overall_score * session_weight(s) for s in qualified) / total_weight
            if total_weight > 0
            else 0.0
        )
        cons_score = calc_consistency(qualified)
        composite = weighted_score * 0.8 + cons_score * 0.2

        console.print()
        console.print(
            Panel(
                f"Qualified: {len(qualified)} | Excluded: {excluded}\n"
                f"Weighted Score: {weighted_score:.2f} | Consistency: {cons_score:.1f} | "
                f"Composite Rank: {composite:.2f}",
                title="[bold]Fair Comparison Metrics[/bold]",
                border_style="cyan",
            )
        )


@cli.command()
@click.option("--project", help="Filter by project path substring")
@click.option("--since", help="Only sessions after this date (YYYY-MM-DD)")
@click.option(
    "--dimension",
    type=click.Choice(["all", "more", "longer", "thicker", "fewer"]),
    default="all",
)
@click.pass_context
def trend(ctx, project: Optional[str], since: Optional[str], dimension: str):
    """Show improvement trends over time."""
    store = MetricsStore()
    since_dt = _parse_date(since) if since else None

    sessions = store.load_all(project_filter=project, since=since_dt)

    if not sessions:
        console.print("[yellow]No data. Run 'omas scan' first.[/yellow]")
        return

    render_trend(sessions, dimension=dimension)


@cli.command()
@click.option("--project", help="Filter by project path substring")
@click.option("--since", help="Only sessions after this date (YYYY-MM-DD)")
@click.pass_context
def scan(ctx, project: Optional[str], since: Optional[str]):
    """Scan all session JSONL files and build metrics database."""
    claude_dir = ctx.obj["claude_dir"]
    since_dt = _parse_date(since) if since else None

    console.print("[bold]Scanning Claude Code sessions...[/bold]")

    sessions = discover_sessions(
        claude_dir=claude_dir,
        project_filter=project,
        since=since_dt,
    )

    if not sessions:
        console.print("[yellow]No sessions found.[/yellow]")
        return

    console.print(f"Found {len(sessions)} sessions")

    store = MetricsStore()
    success_count = 0
    error_count = 0

    with Progress() as progress:
        task = progress.add_task("Analyzing sessions...", total=len(sessions))

        for session_info in sessions:
            try:
                data = parse_session(
                    session_info["jsonl_path"],
                    subagent_dir=session_info.get("subagent_dir"),
                )
                data.project_path = session_info["project_path"]
                data.project_hash = session_info["project_hash"]

                metrics = compute_session_metrics(
                    data,
                    project_path=session_info["project_path"],
                    project_hash=session_info["project_hash"],
                )

                store.save_metrics(metrics)
                success_count += 1
            except Exception as e:
                error_count += 1

            progress.advance(task)

    console.print(
        f"[green]Scan complete: {success_count} sessions analyzed, "
        f"{error_count} errors[/green]"
    )
    console.print(f"Database: {store.db_path}")


@cli.command("list")
@click.option("--project", help="Filter by project path substring")
@click.option("--limit", default=30, help="Max sessions to show")
@click.pass_context
def list_sessions(ctx, project: Optional[str], limit: int):
    """List all discovered sessions."""
    claude_dir = ctx.obj["claude_dir"]

    sessions = discover_sessions(claude_dir=claude_dir, project_filter=project)

    if not sessions:
        console.print("[yellow]No sessions found.[/yellow]")
        return

    from rich.table import Table

    table = Table(title=f"Sessions ({len(sessions)} total)")
    table.add_column("#", justify="right", style="dim")
    table.add_column("Session ID")
    table.add_column("Project", max_width=40)
    table.add_column("Modified")
    table.add_column("Size", justify="right")
    table.add_column("Sub-agents", justify="right")

    for i, s in enumerate(sessions[:limit], 1):
        table.add_row(
            str(i),
            s["session_id"][:12] + "...",
            s["project_path"].split("/")[-1] if s["project_path"] else "N/A",
            s["modified_at"].strftime("%Y-%m-%d %H:%M"),
            f"{s['file_size_kb']:.0f} KB",
            str(s["subagent_count"]),
        )

    console.print(table)


@cli.command()
@click.option("--output", "-o", type=click.Path(path_type=Path), help="Output JSON file path")
@click.option("--project", help="Filter by project path substring")
@click.option("--since", help="Only sessions after this date (YYYY-MM-DD)")
@click.pass_context
def export(ctx, output: Optional[Path], project: Optional[str], since: Optional[str]):
    """Export metrics as JSON for the Next.js dashboard."""
    store = MetricsStore()
    since_dt = _parse_date(since) if since else None

    sessions = store.load_all(project_filter=project, since=since_dt)

    if not sessions:
        console.print("[yellow]No data. Run 'omas scan' first.[/yellow]")
        return

    # Build project summaries
    projects = _build_project_summaries(sessions)

    # Compute comparison metrics
    qualified = [s for s in sessions if is_qualified(s)]
    excluded = len(sessions) - len(qualified)
    if qualified:
        total_weight = sum(session_weight(s) for s in qualified)
        weighted_score = (
            sum(s.overall_score * session_weight(s) for s in qualified) / total_weight
            if total_weight > 0
            else 0.0
        )
        cons_score = calc_consistency(qualified)
        composite = weighted_score * 0.8 + cons_score * 0.2
    else:
        weighted_score = 0.0
        cons_score = 5.0
        composite = 0.0

    comparison = ComparisonMetrics(
        qualified_session_count=len(qualified),
        excluded_session_count=excluded,
        weighted_overall_score=round(weighted_score, 2),
        consistency_score=round(cons_score, 1),
        composite_rank_score=round(composite, 2),
    )

    export_data = ExportData(
        generated_at=datetime.now(),
        total_sessions=len(sessions),
        sessions=sessions,
        projects=projects,
        comparison=comparison,
    )

    # Determine output path
    if output is None:
        dashboard_dir = Path(__file__).parent.parent.parent / "dashboard" / "public" / "data"
        dashboard_dir.mkdir(parents=True, exist_ok=True)
        output = dashboard_dir / "metrics.json"

    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w", encoding="utf-8") as f:
        f.write(export_data.model_dump_json(indent=2))

    console.print(f"[green]Exported {len(sessions)} sessions to {output}[/green]")


@cli.command()
@click.pass_context
def dashboard(ctx):
    """Export metrics and launch Next.js dashboard."""
    # Run export first
    ctx.invoke(export)

    dashboard_dir = Path(__file__).parent.parent.parent / "dashboard"
    if not dashboard_dir.exists():
        console.print(f"[red]Dashboard not found at {dashboard_dir}[/red]")
        console.print("Run 'cd dashboard && npm install' first.")
        return

    console.print("[bold]Starting Next.js dashboard...[/bold]")
    console.print(f"Dashboard directory: {dashboard_dir}")

    try:
        subprocess.run(["npm", "run", "dev"], cwd=dashboard_dir)
    except KeyboardInterrupt:
        console.print("\n[dim]Dashboard stopped.[/dim]")
    except FileNotFoundError:
        console.print("[red]npm not found. Please install Node.js first.[/red]")


# --- Helpers ---


def _parse_date(date_str: str) -> datetime:
    """Parse a date string (YYYY-MM-DD)."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise click.BadParameter(f"Invalid date format: {date_str}. Use YYYY-MM-DD.")


def _build_project_summaries(sessions: list[SessionMetrics]) -> list[ProjectSummary]:
    """Build project-level summaries from session metrics."""
    from collections import Counter, defaultdict

    project_sessions: dict[str, list[SessionMetrics]] = defaultdict(list)
    for s in sessions:
        key = s.project_hash or s.project_path or "unknown"
        project_sessions[key].append(s)

    summaries = []
    for project_key, proj_sessions in project_sessions.items():
        if not proj_sessions:
            continue

        type_counts = Counter(s.thread_type.value for s in proj_sessions)
        dominant = max(type_counts, key=lambda k: type_counts[k])

        summaries.append(
            ProjectSummary(
                project_path=proj_sessions[0].project_path,
                project_hash=proj_sessions[0].project_hash,
                session_count=len(proj_sessions),
                total_tool_calls=sum(s.total_tool_calls for s in proj_sessions),
                avg_parallelism_score=_avg(
                    [s.parallelism.p_thread_score for s in proj_sessions]
                ),
                avg_autonomy_score=_avg(
                    [s.autonomy.l_thread_score for s in proj_sessions]
                ),
                avg_density_score=_avg(
                    [s.density.b_thread_score for s in proj_sessions]
                ),
                avg_trust_score=_avg(
                    [s.trust.z_thread_score for s in proj_sessions]
                ),
                avg_overall_score=_avg([s.overall_score for s in proj_sessions]),
                dominant_thread_type=ThreadType(dominant),
                thread_type_distribution=dict(type_counts),
                sessions=[s.session_id for s in proj_sessions],
            )
        )

    summaries.sort(key=lambda p: p.session_count, reverse=True)
    return summaries


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


# --- Auth & Cloud Commands ---


@cli.group()
def auth():
    """Manage authentication for OMAS Cloud."""
    pass


@auth.command("login")
@click.option("--provider", type=click.Choice(["github", "google"]), default="github")
def auth_login(provider: str):
    """Login to OMAS Cloud via OAuth."""
    from omas.cloud.auth import start_device_flow
    start_device_flow(provider)


@auth.command("logout")
def auth_logout():
    """Logout from OMAS Cloud."""
    from omas.cloud.credentials import clear_credentials
    clear_credentials()
    console.print("[green]Logged out successfully.[/green]")


@auth.command("status")
def auth_status():
    """Show current authentication status."""
    from omas.cloud.credentials import get_credentials
    creds = get_credentials()
    if creds:
        console.print(f"[green]Authenticated as: {creds.get('username', 'unknown')}[/green]")
        console.print(f"Provider: {creds.get('provider', 'unknown')}")
    else:
        console.print("[yellow]Not authenticated. Run 'omas auth login'.[/yellow]")


@cli.command()
@click.option("--dry-run", is_flag=True, help="Show what would be uploaded without uploading")
@click.pass_context
def upload(ctx, dry_run: bool):
    """Upload metrics to OMAS Cloud."""
    from omas.cloud.upload import upload_metrics
    from omas.storage.sqlite_store import MetricsStore as _MetricsStore
    store = _MetricsStore()
    sessions = store.load_all()
    if not sessions:
        console.print("[yellow]No data to upload. Run 'omas scan' first.[/yellow]")
        return
    upload_metrics(sessions, dry_run=dry_run)
