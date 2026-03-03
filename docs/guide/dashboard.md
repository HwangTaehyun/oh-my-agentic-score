# Dashboard

OMAS includes an interactive web dashboard built with Next.js 15 for visualizing your agentic coding metrics.

## Launching the Dashboard

```bash
# Scan sessions and launch in one step
omas dashboard

# Or manually export and start
omas scan
omas export
cd dashboard && npm run dev
```

The dashboard opens at `http://localhost:3000` and reads data from `dashboard/public/data/metrics.json`.

## Prerequisites

- Node.js 18+
- Run `npm install` in the `dashboard/` directory once before first use

## Dashboard Pages

### Overview

The main overview page displays:

- **Radar Chart**: A 4-axis chart showing your average scores across More (parallelism), Longer (autonomy), Thicker (density), and Fewer (trust)
- **Thread Type Distribution**: Pie chart showing the breakdown of Base, C, P, L, F, B, and Z threads across your sessions
- **Summary Stats**: Total sessions, average overall score, dominant thread type

### Score Trends

Line charts showing how your dimension scores evolve over time:

- Individual dimension trends (More, Longer, Thicker, Fewer)
- Overall score trend line
- Filter by project or date range

### Per-Project Breakdown

Table view with per-project aggregated metrics:

- Average scores per dimension
- Session count and dominant thread type
- Thread type distribution within each project

### Session Detail

Click any session to view its detailed metrics:

- Individual dimension scores with breakdowns
- Thread type classification with explanation
- Raw metric values (tool calls, duration, sub-agents, etc.)
- Fair comparison qualification status

## Data Flow

```
~/.claude/projects/  →  omas scan  →  ~/.omas/metrics.db
                                           ↓
                                      omas export
                                           ↓
                              dashboard/public/data/metrics.json
                                           ↓
                                    Next.js Dashboard
```

All data stays local. The dashboard reads a static JSON file — no backend server or API calls required.
