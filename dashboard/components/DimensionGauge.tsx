"use client";

import { SessionMetrics, DIMENSION_COLORS } from "@/lib/types";

interface DimensionGaugeProps {
  sessions: SessionMetrics[];
}

interface DimensionData {
  key: string;
  label: string;
  full: string;
  value: number;
  color: string;
  icon: string;
}

export default function DimensionGauge({ sessions }: DimensionGaugeProps) {
  if (!sessions.length) return null;

  const avg = (fn: (s: SessionMetrics) => number) =>
    sessions.reduce((sum, x) => sum + fn(x), 0) / sessions.length;

  const avgMore = avg((s) => Math.min(s.parallelism.p_thread_score, 10));
  const avgLonger = avg((s) => s.autonomy.l_thread_score);
  const avgThicker = avg((s) => Math.min(s.density.b_thread_score, 10));
  const avgFewer = avg((s) => s.trust.z_thread_score);

  const dimensions: DimensionData[] = [
    {
      key: "more",
      label: "More",
      full: "Parallelism",
      value: avgMore,
      color: DIMENSION_COLORS.more,
      icon: "M",
    },
    {
      key: "longer",
      label: "Longer",
      full: "Autonomy",
      value: avgLonger,
      color: DIMENSION_COLORS.longer,
      icon: "L",
    },
    {
      key: "thicker",
      label: "Thicker",
      full: "Density",
      value: avgThicker,
      color: DIMENSION_COLORS.thicker,
      icon: "T",
    },
    {
      key: "fewer",
      label: "Fewer",
      full: "Trust",
      value: avgFewer,
      color: DIMENSION_COLORS.fewer,
      icon: "F",
    },
  ];

  const overallAvg =
    (avgMore + avgLonger + avgThicker + avgFewer) / 4;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-300">
          4-Dimension Score
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">OVERALL</span>
          <span
            className="text-lg font-bold font-mono text-glow-green"
            style={{ color: "#00FF88" }}
          >
            {overallAvg.toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-600 font-mono">/ 10</span>
        </div>
      </div>

      <div className="space-y-3">
        {dimensions.map((dim, i) => (
          <DimensionBar key={dim.key} dim={dim} delay={i * 100} />
        ))}
      </div>
    </div>
  );
}

function DimensionBar({
  dim,
  delay,
}: {
  dim: DimensionData;
  delay: number;
}) {
  const pct = Math.min((dim.value / 10) * 100, 100);

  // Score level label
  const level =
    dim.value >= 8
      ? "Excellent"
      : dim.value >= 5
      ? "Good"
      : dim.value >= 2
      ? "Fair"
      : "Low";

  return (
    <div
      className="animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {/* Colored icon badge */}
          <span
            className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: dim.color + "22",
              color: dim.color,
            }}
          >
            {dim.icon}
          </span>
          <span
            className="text-sm font-semibold"
            style={{ color: dim.color }}
          >
            {dim.label}
          </span>
          <span className="text-[10px] text-gray-600">{dim.full}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">{level}</span>
          <span
            className="text-sm font-bold font-mono"
            style={{ color: dim.color }}
          >
            {dim.value.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2.5 bg-gray-800 rounded-full overflow-hidden">
        {/* Track marks at 2, 4, 6, 8 */}
        {[2, 4, 6, 8].map((mark) => (
          <div
            key={mark}
            className="absolute top-0 bottom-0 w-px bg-gray-700"
            style={{ left: `${mark * 10}%` }}
          />
        ))}

        {/* Filled bar */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${dim.color}44, ${dim.color})`,
            animationDelay: `${delay + 200}ms`,
          }}
        />

        {/* Glow effect at the tip */}
        {pct > 5 && (
          <div
            className="absolute top-0 h-full w-3 rounded-full"
            style={{
              left: `${Math.max(pct - 2, 0)}%`,
              background: `radial-gradient(circle, ${dim.color}66, transparent)`,
            }}
          />
        )}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px] text-gray-700 font-mono">0</span>
        <span className="text-[8px] text-gray-700 font-mono">5</span>
        <span className="text-[8px] text-gray-700 font-mono">10</span>
      </div>
    </div>
  );
}
