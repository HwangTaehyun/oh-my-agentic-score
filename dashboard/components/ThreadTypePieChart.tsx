"use client";

import { Doughnut } from "react-chartjs-2";
import { SessionMetrics, ThreadType, THREAD_COLORS } from "@/lib/types";

interface ThreadTypePieChartProps {
  sessions: SessionMetrics[];
}

export default function ThreadTypePieChart({ sessions }: ThreadTypePieChartProps) {
  if (!sessions.length) return null;

  const counts: Record<string, number> = {};
  for (const s of sessions) {
    counts[s.thread_type] = (counts[s.thread_type] || 0) + 1;
  }

  const types = Object.keys(counts) as ThreadType[];
  const values = types.map((t) => counts[t]);
  const colors = types.map((t) => THREAD_COLORS[t] || "#6B7280");

  const data = {
    labels: types,
    datasets: [
      {
        data: values,
        backgroundColor: colors.map((c) => c + "CC"),
        borderColor: colors,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: { color: "#D1D5DB", font: { size: 11 } },
      },
    },
  };

  return (
    <div className="rounded-lg p-4" style={{ background: "#0A0A0A", border: "1px solid #2f2f2f" }}>
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Thread Type Distribution
      </h3>
      <div className="max-w-xs mx-auto">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
}
