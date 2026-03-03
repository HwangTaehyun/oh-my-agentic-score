"use client";

import { Bar } from "react-chartjs-2";
import { TooltipItem } from "chart.js";
import { SessionMetrics, PeriodType } from "@/lib/types";
import { groupByPeriod } from "@/lib/data";

interface ToolCallBarChartProps {
  sessions: SessionMetrics[];
  period: PeriodType;
}

export default function ToolCallBarChart({
  sessions,
  period,
}: ToolCallBarChartProps) {
  if (!sessions.length) return null;

  const groups = groupByPeriod(sessions, period);
  const sortedKeys = Array.from(groups.keys()).sort();

  const labels = sortedKeys;

  // Avg tool calls per session for each period
  const avgToolsPerSession = sortedKeys.map((k) => {
    const group = groups.get(k)!;
    const total = group.reduce((sum, s) => sum + s.total_tool_calls, 0);
    return Math.round(total / group.length);
  });

  // Session counts for tooltip context
  const sessionCounts = sortedKeys.map((k) => groups.get(k)!.length);
  const totalToolCalls = sortedKeys.map((k) =>
    groups.get(k)!.reduce((sum, s) => sum + s.total_tool_calls, 0)
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Avg Tools/Session",
        data: avgToolsPerSession,
        backgroundColor: "rgba(6, 182, 212, 0.6)",
        borderColor: "rgba(6, 182, 212, 1)",
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<"bar">) => {
            const idx = ctx.dataIndex;
            return [
              `Avg: ${avgToolsPerSession[idx]} tools/session`,
              `Total: ${totalToolCalls[idx].toLocaleString()} calls`,
              `Sessions: ${sessionCounts[idx]}`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#6B7280" },
        grid: { color: "#1F2937" },
      },
      y: {
        ticks: { color: "#06B6D4" },
        grid: { color: "#1F2937" },
        title: {
          display: true,
          text: "Avg Tools / Session",
          color: "#06B6D4",
        },
      },
    },
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">
          Avg Tool Calls per Session
        </h3>
        <span className="text-xs text-gray-500">
          {sessions.length} sessions
        </span>
      </div>
      <Bar data={data} options={options} />
    </div>
  );
}
