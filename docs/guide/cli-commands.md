# CLI Commands

OMAS provides a Click-based CLI with the following commands. All commands accept a `--claude-dir` option to override the default Claude Code data directory (`~/.claude`).

## `omas scan`

Scan all Claude Code session JSONL files and build the metrics database.

```bash
omas scan
omas scan --project my-project
omas scan --since 2025-01-01
```

| Option | Description |
|--------|-------------|
| `--project` | Filter by project path substring |
| `--since` | Only sessions after this date (`YYYY-MM-DD`) |

## `omas analyze`

Analyze a single session by its ID. Supports partial ID matching.

```bash
omas analyze abc123
omas analyze abc123 --json-output
```

| Option | Description |
|--------|-------------|
| `SESSION_ID` | Full or partial session ID (required) |
| `--json-output` | Output metrics as JSON instead of the Rich dashboard |

## `omas report`

Generate an overall report across all stored sessions.

```bash
omas report
omas report --project my-project --limit 100
omas report --since 2025-06-01
```

| Option | Description |
|--------|-------------|
| `--project` | Filter by project path substring |
| `--since` | Only sessions after this date (`YYYY-MM-DD`) |
| `--limit` | Maximum sessions to display (default: 50) |

## `omas trend`

Show score improvement trends over time.

```bash
omas trend
omas trend --dimension longer
omas trend --project my-app --since 2025-03-01
```

| Option | Description |
|--------|-------------|
| `--project` | Filter by project path substring |
| `--since` | Only sessions after this date (`YYYY-MM-DD`) |
| `--dimension` | One of `all`, `more`, `longer`, `thicker`, `fewer` (default: `all`) |

## `omas export`

Export metrics as JSON for the Next.js dashboard.

```bash
omas export
omas export -o ./my-metrics.json
omas export --project my-app
```

| Option | Description |
|--------|-------------|
| `-o`, `--output` | Output JSON file path (default: `dashboard/public/data/metrics.json`) |
| `--project` | Filter by project path substring |
| `--since` | Only sessions after this date (`YYYY-MM-DD`) |

## `omas dashboard`

Export metrics and launch the Next.js interactive dashboard.

```bash
omas dashboard
```

This command runs `omas export` first, then starts the Next.js development server from the `dashboard/` directory.

::: tip
Make sure you have Node.js 18+ installed and have run `npm install` in the `dashboard/` directory.
:::

## `omas list`

List all discovered Claude Code sessions.

```bash
omas list
omas list --project my-project --limit 50
```

| Option | Description |
|--------|-------------|
| `--project` | Filter by project path substring |
| `--limit` | Maximum sessions to display (default: 30) |

## `omas tui`

Launch the interactive terminal UI powered by Trogon.

```bash
omas tui
```

Opens a form-based interface where you can select commands and fill in options interactively. See [TUI Mode](/guide/tui-mode) for details.

## `omas auth`

Manage authentication for OMAS Cloud.

### `omas auth login`

```bash
omas auth login
```

Authenticates via GitHub OAuth device flow.

### `omas auth logout`

```bash
omas auth logout
```

### `omas auth status`

```bash
omas auth status
```

## `omas upload`

Upload session metrics to OMAS Cloud.

```bash
omas upload
omas upload --dry-run
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview what would be uploaded without actually uploading |

::: warning
Cloud upload requires authentication. Run `omas auth login` first.
:::
