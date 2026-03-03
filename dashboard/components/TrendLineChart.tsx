"use client";

import { Line } from "react-chartjs-2";
import { SessionMetrics, DIMENSION_COLORS } from "@/lib/types";
import { parseISO, format } from "date-fns";

interface TrendLineChartProps {
  sessions: SessionMetrics[];
}

export default function TrendLineChart({ sessions }: TrendLineChartProps) {
  if (!sessions.length) return null;

  const sorted = [...sessions]
    .filter((s) => s.timestamp)
    .sort((a, b) => a.timestamp!.localeCompare(b.timestamp!));

  const labels = sorted.map((s) => format(parseISO(s.timestamp!), "MM/dd"));

  const data = {
    labels,
    datasets: [
      {
        label: "More",
        data: sorted.map((s) =>
          Math.min(s.parallelism.p_thread_score * 2, 10)
        ),
        borderColor: DIMENSION_COLORS.more,
        backgroundColor: DIMENSION_COLORS.more + "33",
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: "Longer",
        data: sorted.map((s) => s.autonomy.l_thread_score),
        borderColor: DIMENSION_COLORS.longer,
        backgroundColor: DIMENSION_COLORS.longer + "33",
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: "Thicker",
        data: sorted.map((s) => Math.min(s.density.b_thread_score, 10)),
        borderColor: DIMENSION_COLORS.thicker,
        backgroundColor: DIMENSION_COLORS.thicker + "33",
        tension: 0.3,
        pointRadius: 2,
      },
      {
        label: "Fewer",
        data: sorted.map((s) => s.trust.z_thread_score),
        borderColor: DIMENSION_COLORS.fewer,
        backgroundColor: DIMENSION_COLORS.fewer + "33",
        tension: 0.3,
        pointRadius: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: { color: "#D1D5DB", font: { size: 11 } },
      },
    },
    scales: {
      x: { ticks: { color: "#6B7280" }, grid: { color: "#1F2937" } },
      y: {
        min: 0,
        max: 10,
        ticks: { color: "#6B7280" },
        grid: { color: "#1F2937" },
      },
    },
  };

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">
        Per-Session Agentic Score
      </h3>
      <Line data={data} options={options} />
    </div>
  );
}
