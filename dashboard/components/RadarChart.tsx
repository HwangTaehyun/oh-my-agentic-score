"use client";

import { Radar } from "react-chartjs-2";
import type { SessionMetrics } from "@/lib/types";
import { DIMENSION_COLORS } from "@/lib/types";

interface RadarChartProps {
  sessions: SessionMetrics[];
}

export default function RadarChart({ sessions }: RadarChartProps) {
  if (!sessions.length) return null;

  const avg = (fn: (s: SessionMetrics) => number) =>
    sessions.reduce((sum, x) => sum + fn(x), 0) / sessions.length;

  const avgMore = avg((s) => Math.min(s.parallelism.p_thread_score, 10));
  const avgLonger = avg((s) => s.autonomy.l_thread_score);
  const avgThicker = avg((s) => Math.min(s.density.b_thread_score + (s.density.ai_line_bonus || 0), 10));
  const avgFewer = avg((s) => s.trust.z_thread_score);

  const data = {
    labels: ["More", "Longer", "Thicker", "Fewer"],
    datasets: [
      {
        label: "Average Score",
        data: [avgMore, avgLonger, avgThicker, avgFewer],
        backgroundColor: "rgba(0, 255, 136, 0.06)",
        borderColor: "rgba(0, 255, 136, 0.5)",
        borderWidth: 2,
        pointBackgroundColor: [
          DIMENSION_COLORS.more,
          DIMENSION_COLORS.longer,
          DIMENSION_COLORS.thicker,
          DIMENSION_COLORS.fewer,
        ],
        pointBorderColor: [
          DIMENSION_COLORS.more,
          DIMENSION_COLORS.longer,
          DIMENSION_COLORS.thicker,
          DIMENSION_COLORS.fewer,
        ],
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBorderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    animation: {
      duration: 1200,
      easing: "easeOutQuart" as const,
    },
    layout: {
      padding: { top: 8, bottom: 8, left: 8, right: 8 },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#111827",
        titleColor: "#00FF88",
        bodyColor: "#D1D5DB",
        borderColor: "#1F2937",
        borderWidth: 1,
        padding: 10,
        displayColors: false,
        callbacks: {
          title: (items: { label: string }[]) => {
            const fullNames: Record<string, string> = {
              More: "More (Parallelism)",
              Longer: "Longer (Autonomy)",
              Thicker: "Thicker (Density)",
              Fewer: "Fewer (Trust)",
            };
            return fullNames[items[0]?.label] || items[0]?.label;
          },
          label: (ctx: { parsed: { r: number } }) =>
            `Score: ${ctx.parsed.r.toFixed(2)} / 10`,
        },
      },
    },
    scales: {
      r: {
        min: 0,
        max: 10,
        ticks: {
          stepSize: 2,
          color: "#374151",
          backdropColor: "transparent",
          font: { size: 9, family: "monospace" },
          z: 1,
        },
        grid: {
          color: "rgba(55, 65, 81, 0.4)",
          lineWidth: 1,
        },
        pointLabels: {
          color: (ctx: { index: number }) => {
            const colors = [
              DIMENSION_COLORS.more,
              DIMENSION_COLORS.longer,
              DIMENSION_COLORS.thicker,
              DIMENSION_COLORS.fewer,
            ];
            return colors[ctx.index] || "#9CA3AF";
          },
          font: { size: 12, weight: "bold" as const },
          padding: 12,
        },
        angleLines: {
          color: "rgba(55, 65, 81, 0.3)",
        },
      },
    },
  };

  const scores = [
    {
      label: "More",
      full: "Parallelism",
      value: avgMore,
      color: DIMENSION_COLORS.more,
    },
    {
      label: "Longer",
      full: "Autonomy",
      value: avgLonger,
      color: DIMENSION_COLORS.longer,
    },
    {
      label: "Thicker",
      full: "Density",
      value: avgThicker,
      color: DIMENSION_COLORS.thicker,
    },
    {
      label: "Fewer",
      full: "Trust",
      value: avgFewer,
      color: DIMENSION_COLORS.fewer,
    },
  ];

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">
        4-Dimension Radar
      </h3>
      <div className="flex justify-center">
        <div className="w-64 h-64">
          <Radar data={data} options={options} />
        </div>
      </div>
      {/* Score badges */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {scores.map((s, i) => (
          <div
            key={s.label}
            className="text-center animate-fade-in rounded-md py-2"
            style={{
              animationDelay: `${400 + i * 100}ms`,
              backgroundColor: s.color + "08",
            }}
          >
            <div
              className="text-lg font-bold font-mono leading-none"
              style={{ color: s.color }}
            >
              {s.value.toFixed(2)}
            </div>
            <div className="text-[10px] font-semibold mt-1" style={{ color: s.color + "AA" }}>
              {s.label}
            </div>
            <div className="text-[9px] text-gray-600">{s.full}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
