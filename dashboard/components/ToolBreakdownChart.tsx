"use client";

import { Bar } from "react-chartjs-2";
import { TooltipItem } from "chart.js";
import { SessionMetrics, TOOL_CATEGORY_COLORS } from "@/lib/types";

interface ToolBreakdownChartProps {
  sessions: SessionMetrics[];
}

/** Categorize an MCP tool name into a short display label. */
function categorizeTool(name: string): string {
  if (name.startsWith("mcp__")) {
    const parts = name.split("__");
    return parts.length >= 2 ? `MCP:${parts[1]}` : "MCP";
  }
  if (name.startsWith("Task")) return "Task*";
  if (name.startsWith("Notebook")) return "Notebook*";
  return name;
}

/** Get a color for a tool name. */
function getToolColor(name: string): string {
  if (TOOL_CATEGORY_COLORS[name]) return TOOL_CATEGORY_COLORS[name];
  if (name.startsWith("MCP:")) return TOOL_CATEGORY_COLORS.MCP;
  if (name.startsWith("Task")) return "#F59E0B";
  return TOOL_CATEGORY_COLORS.Other;
}

const CARD_STYLE = { background: "#0A0A0A", border: "1px solid #2f2f2f" };

/** Aggregate tool_breakdown across sessions and return top 15. */
function aggregateTools(sessions: SessionMetrics[]) {
  const aggregated: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.tool_breakdown) continue;
    for (const [tool, count] of Object.entries(s.tool_breakdown)) {
      const category = categorizeTool(tool);
      aggregated[category] = (aggregated[category] || 0) + count;
    }
  }
  const sorted = Object.entries(aggregated)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  return { aggregated, sorted };
}

/** Build chart.js data and options from sorted tool data. */
function buildChartConfig(sorted: [string, number][]) {
  const labels = sorted.map(([name]) => name);
  const values = sorted.map(([, count]) => count);
  const colors = labels.map((name) => getToolColor(name));

  const data = {
    labels,
    datasets: [{
      label: "Total Calls",
      data: values,
      backgroundColor: colors.map((c) => c + "99"),
      borderColor: colors,
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<"bar">) => {
            const val = ctx.parsed.x ?? 0;
            const total = values.reduce((s, v) => s + v, 0);
            return `${val.toLocaleString()} calls (${total > 0 ? ((val / total) * 100).toFixed(2) : 0}%)`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#6B7280" },
        grid: { color: "#1F2937" },
        title: { display: true, text: "Total Calls", color: "#6B7280" },
      },
      y: {
        ticks: { color: "#D1D5DB", font: { size: 12 } },
        grid: { display: false },
      },
    },
  };

  return { data, options, labels, values };
}

function EmptyState() {
  return (
    <div className="rounded-lg p-4" style={CARD_STYLE}>
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Tool Usage Breakdown</h3>
      <p className="text-gray-500 text-sm">
        No tool breakdown data available. Run{" "}
        <code className="px-1 rounded" style={{ background: "#1A1A1A" }}>omas scan</code> to regenerate.
      </p>
    </div>
  );
}

function TopToolBadge({ name, count }: { name: string; count: number }) {
  const color = getToolColor(name);
  return (
    <div className="flex items-center gap-2 mb-3 text-xs">
      <span className="text-gray-500">Most used:</span>
      <span
        className="px-2 py-0.5 rounded-full font-medium"
        style={{ backgroundColor: color + "22", color }}
      >
        {name} ({count.toLocaleString()})
      </span>
    </div>
  );
}

export default function ToolBreakdownChart({ sessions }: ToolBreakdownChartProps) {
  if (!sessions.length) return null;

  const { aggregated, sorted } = aggregateTools(sessions);
  if (!sorted.length) return <EmptyState />;

  const { data, options, values } = buildChartConfig(sorted);
  const totalCalls = values.reduce((s, v) => s + v, 0);

  return (
    <div className="rounded-lg p-4" style={CARD_STYLE}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">Tool Usage Breakdown</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{Object.keys(aggregated).length} tool types</span>
          <span>{totalCalls.toLocaleString()} total calls</span>
        </div>
      </div>
      <TopToolBadge name={sorted[0][0]} count={sorted[0][1]} />
      <div style={{ height: `${Math.max(sorted.length * 28, 200)}px` }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
