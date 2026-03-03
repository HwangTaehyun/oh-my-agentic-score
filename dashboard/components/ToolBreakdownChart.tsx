"use client";

import { Bar } from "react-chartjs-2";
import { TooltipItem } from "chart.js";
import { SessionMetrics, TOOL_CATEGORY_COLORS } from "@/lib/types";

interface ToolBreakdownChartProps {
  sessions: SessionMetrics[];
}

/**
 * Categorize an MCP tool name into a short display label.
 * e.g., "mcp__chrome-devtools__take_screenshot" → "MCP:chrome-devtools"
 */
function categorizeTool(name: string): string {
  if (name.startsWith("mcp__")) {
    const parts = name.split("__");
    // mcp__<server>__<tool> → "MCP:<server>"
    return parts.length >= 2 ? `MCP:${parts[1]}` : "MCP";
  }
  // TaskCreate, TaskUpdate, TaskList, TaskGet, TaskStop → "Task*"
  if (name.startsWith("Task")) return "Task*";
  // NotebookEdit, NotebookRead → "Notebook*"
  if (name.startsWith("Notebook")) return "Notebook*";
  // SendMessage → "SendMessage"
  return name;
}

/**
 * Get a color for a tool name, falling back to category or default gray.
 */
function getToolColor(name: string): string {
  // Direct match
  if (TOOL_CATEGORY_COLORS[name]) return TOOL_CATEGORY_COLORS[name];
  // MCP grouped
  if (name.startsWith("MCP:")) return TOOL_CATEGORY_COLORS.MCP;
  // Task grouped
  if (name.startsWith("Task")) return "#F59E0B";
  return TOOL_CATEGORY_COLORS.Other;
}

export default function ToolBreakdownChart({
  sessions,
}: ToolBreakdownChartProps) {
  if (!sessions.length) return null;

  // Aggregate tool_breakdown across all sessions
  const aggregated: Record<string, number> = {};
  for (const s of sessions) {
    if (!s.tool_breakdown) continue;
    for (const [tool, count] of Object.entries(s.tool_breakdown)) {
      const category = categorizeTool(tool);
      aggregated[category] = (aggregated[category] || 0) + count;
    }
  }

  // Sort by count descending and take top 15
  const sorted = Object.entries(aggregated)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (!sorted.length) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">
          Tool Usage Breakdown
        </h3>
        <p className="text-gray-500 text-sm">
          No tool breakdown data available. Run{" "}
          <code className="bg-gray-800 px-1 rounded">omas scan</code> to
          regenerate.
        </p>
      </div>
    );
  }

  const labels = sorted.map(([name]) => name);
  const values = sorted.map(([, count]) => count);
  const colors = labels.map((name) => getToolColor(name));

  const data = {
    labels,
    datasets: [
      {
        label: "Total Calls",
        data: values,
        backgroundColor: colors.map((c) => c + "99"), // 60% opacity
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
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
            const pct = ((val / total) * 100).toFixed(1);
            return `${val.toLocaleString()} calls (${pct}%)`;
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

  // Compute quick stats
  const totalCalls = values.reduce((s, v) => s + v, 0);
  const topTool = sorted[0];

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">
          Tool Usage Breakdown
        </h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{Object.keys(aggregated).length} tool types</span>
          <span>{totalCalls.toLocaleString()} total calls</span>
        </div>
      </div>

      {/* Top tool highlight */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-gray-500">Most used:</span>
        <span
          className="px-2 py-0.5 rounded-full font-medium"
          style={{
            backgroundColor: getToolColor(topTool[0]) + "22",
            color: getToolColor(topTool[0]),
          }}
        >
          {topTool[0]} ({topTool[1].toLocaleString()})
        </span>
      </div>

      <div style={{ height: `${Math.max(sorted.length * 28, 200)}px` }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
