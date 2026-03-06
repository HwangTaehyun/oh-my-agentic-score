"""CLI entry point for Oh My Agentic Score (omas)."""

from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

# Load .env file if present (before any env reads)
_env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_path.exists():
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if _line and not _line.startswith("#") and "=" in _line:
                _key, _, _val = _line.partition("=")
                os.environ.setdefault(_key.strip(), _val.strip())

import click
from rich.console import Console
from rich.progress import Progress

from omas.config import CLAUDE_DIR, DEFAULT_SERVER_URL, MINIMUM_TOOL_CALLS
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

    # Qualifying gate: skip sessions with no tool calls
    if metrics.total_tool_calls == 0:
        console.print("[yellow]Session skipped: no tool calls detected[/yellow]")
        return

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

    # Note: weighted avg + qualified count now displayed by render_report() itself


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
@click.option("--force", is_flag=True, help="Re-analyze all sessions (ignore cache)")
@click.pass_context
def scan(ctx, project: Optional[str], since: Optional[str], force: bool):
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

    store = MetricsStore()

    # Unless --force, skip sessions already in the database
    if not force:
        stored_ids = store.get_stored_session_ids()
        new_sessions = [s for s in sessions if s["jsonl_path"].stem not in stored_ids]
        if not new_sessions:
            console.print(f"[dim]All {len(sessions)} sessions already analyzed. Use --force to re-analyze.[/dim]")
            return
        console.print(f"Found {len(new_sessions)} new sessions (of {len(sessions)} total, use --force to re-analyze all)")
        sessions = new_sessions
    else:
        console.print(f"Found {len(sessions)} sessions (force re-analyze)")

    success_count = 0
    skipped_count = 0
    error_count = 0

    # Phase 1: Parse all sessions and compute metrics with default concurrent_sessions=1
    parsed_results = []

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

                # Skip sessions with no tool calls (no agentic work)
                if metrics.total_tool_calls == 0:
                    skipped_count += 1
                    progress.advance(task)
                    continue

                parsed_results.append((session_info, data, metrics))
                success_count += 1
            except Exception as e:
                error_count += 1

            progress.advance(task)

    # Phase 2: Compute cross-session P-thread scores from time overlaps
    from omas.metrics.parallelism import compute_cross_session_parallelism

    session_ranges = [
        (data.session_id, data.start_time, data.end_time)
        for _, data, _ in parsed_results
        if data.start_time and data.end_time
    ]
    concurrent_map = compute_cross_session_parallelism(session_ranges)

    # Phase 3: Update P-thread scores for sessions with concurrent > 1, then save
    from omas.classifier.thread_classifier import classify_thread

    for session_info, data, metrics in parsed_results:
        concurrent = concurrent_map.get(data.session_id, 1)
        if concurrent > 1:
            metrics.parallelism.concurrent_sessions = concurrent
            metrics.parallelism.p_thread_score = min(float(concurrent), 10.0)
            # Re-classify thread type with updated concurrent_sessions
            metrics.thread_type = classify_thread(
                data, metrics.parallelism, metrics.autonomy,
                metrics.density, metrics.trust,
            )
            metrics.overall_score = _recompute_overall(metrics)
        store.save_metrics(metrics)

    console.print(
        f"[green]Scan complete: {success_count} sessions analyzed, "
        f"{skipped_count} empty skipped, {error_count} errors[/green]"
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

    # Show project filter summary from stored metrics
    store = MetricsStore()
    stored = store.load_all(project_filter=project)
    if stored:
        projects = _build_project_summaries(stored)
        for p in projects:
            name = p.project_path.split("/")[-1] if p.project_path else p.project_hash
            console.print(
                f"  [dim]{name}: {p.valid_sessions}/{p.session_count} sessions "
                f"({MINIMUM_TOOL_CALLS}+ tools) | avg score {p.avg_overall_score}[/dim]"
            )


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
        composite = weighted_score  # = Cloud leaderboard (no consistency penalty)
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
        from omas.config import OMAS_DIR
        data_dir = OMAS_DIR / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        output = data_dir / "metrics.json"

    output.parent.mkdir(parents=True, exist_ok=True)

    with open(output, "w", encoding="utf-8") as f:
        f.write(export_data.model_dump_json(indent=2))

    console.print(f"[green]Exported {len(sessions)} sessions to {output}[/green]")


@cli.command()
@click.option("--skip-scan", is_flag=True, help="Skip session scan (use cached data)")
@click.option("--skip-upload", is_flag=True, help="Skip cloud upload")
@click.option(
    "--server-url",
    default=DEFAULT_SERVER_URL,
    envvar="OMAS_SERVER_URL",
    help="OMAS Cloud server URL",
)
@click.pass_context
def dashboard(ctx, skip_scan: bool, skip_upload: bool, server_url: str):
    """Scan sessions, upload to cloud, and launch dashboard."""
    # Step 1: Scan sessions (skip if DB already has same count as discovered)
    if not skip_scan:
        claude_dir = ctx.obj["claude_dir"]
        discovered = discover_sessions(claude_dir=claude_dir)
        store = MetricsStore()
        stored_count = store.count()
        if len(discovered) > stored_count:
            console.print(f"[dim]New sessions detected ({len(discovered)} found, {stored_count} stored)[/dim]")
            ctx.invoke(scan)
        else:
            console.print(f"[dim]No new sessions ({stored_count} stored). Skipping scan.[/dim]")

    # Step 2: Export JSON for dashboard
    ctx.invoke(export)

    # Step 3: Upload to cloud (background, non-blocking)
    if not skip_upload:
        _try_cloud_upload(server_url)

    # Step 4: Launch dashboard
    _launch_dashboard()


def _ensure_authenticated(server_url: str) -> bool:
    """Check auth status; if not logged in, prompt and run OAuth flow.

    Returns True if authenticated (existing or just completed).
    """
    from omas.cloud.credentials import get_credentials

    creds = get_credentials()
    if creds and creds.get("access_token"):
        return True

    console.print("\n[yellow]Not authenticated to OMAS Cloud.[/yellow]")
    if not click.confirm("Login now to sync scores to the cloud?", default=True):
        console.print("[dim]Skipping cloud upload.[/dim]")
        return False

    from omas.cloud.auth import start_oauth_flow

    return start_oauth_flow(server_url=server_url)


def _try_cloud_upload(server_url: str) -> None:
    """Ensure authenticated, then upload. Non-fatal on failure."""
    if not _ensure_authenticated(server_url):
        return

    from omas.cloud.credentials import get_credentials
    from omas.cloud.upload import upload_metrics
    from omas.storage.sqlite_store import MetricsStore as _MetricsStore

    creds = get_credentials()
    store = _MetricsStore()
    sessions = store.load_all()
    if not sessions:
        return

    url = (creds or {}).get("server_url", server_url)
    try:
        upload_metrics(sessions, server_url=url)
    except Exception as e:
        console.print(f"[dim]Cloud upload failed: {e} (continuing locally)[/dim]")


def _launch_dashboard() -> None:
    """Start the OMAS dashboard (bundled static or dev mode)."""
    from omas.dashboard_server import serve_dashboard
    serve_dashboard(port=3002)


# --- Helpers ---


def _parse_date(date_str: str) -> datetime:
    """Parse a date string (YYYY-MM-DD)."""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise click.BadParameter(f"Invalid date format: {date_str}. Use YYYY-MM-DD.")


def _build_project_summaries(sessions: list[SessionMetrics]) -> list[ProjectSummary]:
    """Build project-level summaries from session metrics.

    Only sessions with >= MINIMUM_TOOL_CALLS are included in averages
    to filter out trivial/aborted sessions that would skew project scores.
    """
    from collections import Counter, defaultdict

    project_sessions: dict[str, list[SessionMetrics]] = defaultdict(list)
    for s in sessions:
        key = s.project_hash or s.project_path or "unknown"
        project_sessions[key].append(s)

    summaries = []
    for project_key, proj_sessions in project_sessions.items():
        if not proj_sessions:
            continue

        # Filter: only sessions with enough tool calls for meaningful averages
        valid = [s for s in proj_sessions if s.total_tool_calls >= MINIMUM_TOOL_CALLS]
        excluded = len(proj_sessions) - len(valid)

        # Use valid sessions for averages; fall back to all if none qualify
        avg_source = valid if valid else proj_sessions

        type_counts = Counter(s.thread_type.value for s in proj_sessions)
        dominant = max(type_counts, key=lambda k: type_counts[k])

        # Raw dimension averages (from valid sessions only)
        avg_p = _avg([s.parallelism.p_thread_score for s in avg_source])
        avg_l = _avg([s.autonomy.l_thread_score for s in avg_source])
        avg_b = _avg([s.density.b_thread_score for s in avg_source])
        avg_f = _avg([s.trust.z_thread_score for s in avg_source])

        # Normalized dimension averages (same formula as _compute_overall_score)
        p_norm = _avg([min(s.parallelism.p_thread_score, 10.0) for s in avg_source])
        l_norm = _avg([min(s.autonomy.l_thread_score, 10.0) for s in avg_source])
        b_norm = _avg([min(s.density.b_thread_score, 10.0) for s in avg_source])
        f_norm = _avg([min(s.trust.z_thread_score, 10.0) for s in avg_source])

        summaries.append(
            ProjectSummary(
                project_path=proj_sessions[0].project_path,
                project_hash=proj_sessions[0].project_hash,
                session_count=len(proj_sessions),
                valid_sessions=len(valid),
                excluded_sessions=excluded,
                total_tool_calls=sum(s.total_tool_calls for s in proj_sessions),
                avg_parallelism_score=avg_p,
                avg_autonomy_score=avg_l,
                avg_density_score=avg_b,
                avg_trust_score=avg_f,
                avg_parallelism_norm=p_norm,
                avg_autonomy_norm=l_norm,
                avg_density_norm=b_norm,
                avg_trust_norm=f_norm,
                avg_overall_score=_avg([s.overall_score for s in avg_source]),
                dominant_thread_type=ThreadType(dominant),
                thread_type_distribution=dict(type_counts),
                sessions=[s.session_id for s in proj_sessions],
            )
        )

    summaries.sort(key=lambda p: p.session_count, reverse=True)
    return summaries


def _recompute_overall(metrics: SessionMetrics) -> float:
    """Recompute overall score after updating individual dimension scores.

    Mirrors the logic in aggregator._compute_overall_score but operates
    on a SessionMetrics object rather than individual metric objects.
    """
    p_norm = min(metrics.parallelism.p_thread_score, 10.0)
    l_norm = min(metrics.autonomy.l_thread_score, 10.0)
    b_norm = min(metrics.density.b_thread_score + metrics.density.ai_line_bonus, 10.0)
    f_norm = min(metrics.trust.z_thread_score, 10.0)
    return round((p_norm + l_norm + b_norm + f_norm) / 4.0, 2)


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


# --- Auth & Cloud Commands ---


@cli.group()
def auth():
    """Manage authentication for OMAS Cloud."""
    pass


@auth.command("login")
@click.option(
    "--server-url",
    default=DEFAULT_SERVER_URL,
    envvar="OMAS_SERVER_URL",
    help="OMAS Cloud server URL",
)
def auth_login(server_url: str):
    """Login to OMAS Cloud via GitHub OAuth."""
    from omas.cloud.auth import start_oauth_flow
    start_oauth_flow(server_url=server_url)


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
    if not creds:
        console.print("[yellow]Not authenticated. Run 'omas auth login'.[/yellow]")
        return

    user = creds.get("user", {})
    username = user.get("username", "unknown")
    display_name = user.get("display_name", user.get("displayName", username))
    server_url = creds.get("server_url", "unknown")

    console.print(f"[green]Authenticated as: {display_name}[/green]  (@{username})")
    console.print(f"Server: {server_url}")
    console.print(f"Token: {'present' if creds.get('access_token') else 'missing'}")


@cli.command()
@click.option("--dry-run", is_flag=True, help="Show what would be uploaded without uploading")
@click.option("--verbose", "-v", is_flag=True, help="Show detailed upload information (server URL, auth, payload)")
@click.option(
    "--server-url",
    default=DEFAULT_SERVER_URL,
    envvar="OMAS_SERVER_URL",
    help="OMAS Cloud server URL",
)
def upload(dry_run: bool, verbose: bool, server_url: str):
    """Upload metrics to OMAS Cloud."""
    from omas.cloud.upload import upload_metrics
    from omas.storage.sqlite_store import MetricsStore as _MetricsStore

    store = _MetricsStore()
    sessions = store.load_all()
    if not sessions:
        console.print("[yellow]No data to upload. Run 'omas scan' first.[/yellow]")
        return
    upload_metrics(sessions, dry_run=dry_run, server_url=server_url, verbose=verbose)


@cli.command("cloud-status")
@click.option(
    "--server-url",
    default=DEFAULT_SERVER_URL,
    envvar="OMAS_SERVER_URL",
    help="OMAS Cloud server URL",
)
def cloud_status(server_url: str):
    """Check OMAS Cloud server connectivity and stats."""
    from omas.cloud.api_client import ConnectRPCError, OmasCloudClient

    client = OmasCloudClient(base_url=server_url)

    # Health check
    try:
        health = client.health()
        console.print(f"[green]Server: {server_url} — {health.get('status', 'ok')}[/green]")
    except Exception:
        console.print(f"[red]Cannot connect to {server_url}[/red]")
        return

    # Landing stats (public, no auth needed)
    try:
        stats = client.get_landing_stats()
        console.print(f"  Users:    {stats.get('total_users', stats.get('totalUsers', 0))}")
        console.print(f"  Sessions: {stats.get('total_sessions', stats.get('totalSessions', 0))}")
    except ConnectRPCError as e:
        console.print(f"  [dim]Stats unavailable: {e.message}[/dim]")
