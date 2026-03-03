"use client";

import { useMemo } from "react";
import { SessionMetrics, DIMENSION_COLORS } from "@/lib/types";

interface DimensionRadarProps {
  sessions: SessionMetrics[];
}

// Chart geometry
const SIZE = 380;
const CENTER = SIZE / 2;
const RADIUS = 140;
const GRID_LEVELS = 5;
const MAX_VALUE = 10;

// 4 axes in diamond orientation: top → right → bottom → left
const AXES = [
  { key: "more", label: "More", full: "Parallelism", angle: -Math.PI / 2 },
  { key: "longer", label: "Longer", full: "Autonomy", angle: 0 },
  { key: "thicker", label: "Thicker", full: "Density", angle: Math.PI / 2 },
  { key: "fewer", label: "Fewer", full: "Trust", angle: Math.PI },
] as const;

/** Convert polar coords to cartesian */
function toXY(angle: number, r: number): [number, number] {
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

/** Generate polygon points string from values array */
function polygonPts(values: number[]): string {
  return AXES.map((axis, i) => {
    const ratio = Math.min(values[i] / MAX_VALUE, 1);
    const [x, y] = toXY(axis.angle, ratio * RADIUS);
    return `${x},${y}`;
  }).join(" ");
}

/** Generate grid polygon points at a given level (1..GRID_LEVELS) */
function gridPts(level: number): string {
  const ratio = level / GRID_LEVELS;
  return AXES.map((axis) => {
    const [x, y] = toXY(axis.angle, ratio * RADIUS);
    return `${x},${y}`;
  }).join(" ");
}

export default function DimensionRadar({ sessions }: DimensionRadarProps) {
  const { values, overallAvg, colors } = useMemo(() => {
    if (!sessions.length) {
      return {
        values: [0, 0, 0, 0],
        overallAvg: 0,
        colors: Object.values(DIMENSION_COLORS),
      };
    }

    const avg = (fn: (s: SessionMetrics) => number) =>
      sessions.reduce((sum, x) => sum + fn(x), 0) / sessions.length;

    const avgMore = avg((s) => Math.min(s.parallelism.p_thread_score * 2, 10));
    const avgLonger = avg((s) => s.autonomy.l_thread_score);
    const avgThicker = avg((s) => Math.min(s.density.b_thread_score, 10));
    const avgFewer = avg((s) => s.trust.z_thread_score);

    return {
      values: [avgMore, avgLonger, avgThicker, avgFewer],
      overallAvg: (avgMore + avgLonger + avgThicker + avgFewer) / 4,
      colors: [
        DIMENSION_COLORS.more,
        DIMENSION_COLORS.longer,
        DIMENSION_COLORS.thicker,
        DIMENSION_COLORS.fewer,
      ],
    };
  }, [sessions]);

  // Data polygon points
  const dataPoints = polygonPts(values);

  // Individual vertex positions
  const vertices = AXES.map((axis, i) => {
    const ratio = Math.min(values[i] / MAX_VALUE, 1);
    const [x, y] = toXY(axis.angle, ratio * RADIUS);
    return { x, y, value: values[i], color: colors[i], ...axis };
  });

  // Label positions (outside the chart)
  const labelOffset = RADIUS + 32;

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">
          4-Dimension Radar
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">OVERALL</span>
          <span
            className="text-lg font-bold font-mono"
            style={{ color: "#00FF88" }}
          >
            {overallAvg.toFixed(1)}
          </span>
          <span className="text-[10px] text-gray-600 font-mono">/ 10</span>
        </div>
      </div>

      {/* Radar SVG */}
      <div className="flex justify-center">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full max-w-[380px]"
          style={{ overflow: "visible" }}
        >
          <defs>
            {/* Glow filter for data polygon */}
            <filter id="radar-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Individual dot glow filters */}
            {colors.map((color, i) => (
              <filter
                key={`glow-${i}`}
                id={`dot-glow-${i}`}
                x="-100%"
                y="-100%"
                width="300%"
                height="300%"
              >
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="4"
                  floodColor={color}
                  floodOpacity="0.6"
                />
              </filter>
            ))}

            {/* Gradient for data area */}
            <radialGradient id="data-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.15" />
            </radialGradient>

            {/* Gradient fill for alternating grid bands */}
            <radialGradient id="grid-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.04" />
            </radialGradient>
          </defs>

          {/* Alternating grid band fills */}
          {Array.from({ length: GRID_LEVELS }, (_, i) => {
            const level = GRID_LEVELS - i; // draw outer first
            if (level % 2 === 0) return null;
            return (
              <polygon
                key={`band-${level}`}
                points={gridPts(level)}
                fill="rgba(255,255,255,0.025)"
                stroke="none"
              />
            );
          })}

          {/* Concentric grid polygons */}
          {Array.from({ length: GRID_LEVELS }, (_, i) => (
            <polygon
              key={`grid-${i + 1}`}
              points={gridPts(i + 1)}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={i + 1 === GRID_LEVELS ? 1.5 : 0.8}
            />
          ))}

          {/* Axis lines from center to each vertex */}
          {AXES.map((axis, i) => {
            const [x, y] = toXY(axis.angle, RADIUS);
            return (
              <line
                key={`axis-${i}`}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="0.8"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* Data polygon — filled area */}
          <polygon
            points={dataPoints}
            fill="url(#data-gradient)"
            stroke="#06B6D4"
            strokeWidth="2"
            strokeLinejoin="round"
            filter="url(#radar-glow)"
            className="animate-radar-fill"
          />

          {/* Individual dimension colored triangles (subtle) */}
          {vertices.map((v, i) => {
            const next = vertices[(i + 1) % vertices.length];
            return (
              <polygon
                key={`tri-${i}`}
                points={`${CENTER},${CENTER} ${v.x},${v.y} ${next.x},${next.y}`}
                fill={v.color}
                fillOpacity="0.08"
                stroke="none"
              />
            );
          })}

          {/* Vertex dots with glow */}
          {vertices.map((v, i) => (
            <g key={`dot-${i}`}>
              {/* Outer glow ring */}
              <circle
                cx={v.x}
                cy={v.y}
                r="8"
                fill={v.color}
                fillOpacity="0.15"
              />
              {/* Dot */}
              <circle
                cx={v.x}
                cy={v.y}
                r="5"
                fill={v.color}
                filter={`url(#dot-glow-${i})`}
              />
              {/* Inner highlight */}
              <circle
                cx={v.x}
                cy={v.y}
                r="2"
                fill="#ffffff"
                fillOpacity="0.7"
              />
            </g>
          ))}

          {/* Center dot */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r="3"
            fill="rgba(255,255,255,0.2)"
          />

          {/* Axis labels */}
          {AXES.map((axis, i) => {
            const [lx, ly] = toXY(axis.angle, labelOffset);
            const isTop = axis.angle === -Math.PI / 2;
            const isBottom = axis.angle === Math.PI / 2;
            const isLeft = axis.angle === Math.PI;
            const isRight = axis.angle === 0;

            // Text anchor based on position
            const anchor = isLeft
              ? "end"
              : isRight
              ? "start"
              : "middle";

            // Y offset for top/bottom alignment
            const yOff = isTop ? -8 : isBottom ? 8 : 0;

            return (
              <g key={`label-${i}`}>
                {/* Dimension label */}
                <text
                  x={lx}
                  y={ly + yOff}
                  textAnchor={anchor}
                  dominantBaseline="central"
                  fill={colors[i]}
                  fontSize="13"
                  fontWeight="700"
                  fontFamily="'Space Grotesk', system-ui, sans-serif"
                >
                  {axis.label}
                </text>
                {/* Full name */}
                <text
                  x={lx}
                  y={ly + yOff + (isTop ? -16 : 16)}
                  textAnchor={anchor}
                  dominantBaseline="central"
                  fill="rgba(255,255,255,0.35)"
                  fontSize="10"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {axis.full}
                </text>
                {/* Score value near the dot */}
                <text
                  x={vertices[i].x + (isLeft ? -14 : isRight ? 14 : 0)}
                  y={
                    vertices[i].y + (isTop ? -14 : isBottom ? 14 : -12)
                  }
                  textAnchor={anchor}
                  dominantBaseline="central"
                  fill={colors[i]}
                  fontSize="12"
                  fontWeight="700"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {values[i].toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Grid level labels on the top axis */}
          {Array.from({ length: GRID_LEVELS }, (_, i) => {
            const level = i + 1;
            const ratio = level / GRID_LEVELS;
            const [, y] = toXY(-Math.PI / 2, ratio * RADIUS);
            const val = (level / GRID_LEVELS) * MAX_VALUE;
            return (
              <text
                key={`scale-${level}`}
                x={CENTER + 8}
                y={y}
                fill="rgba(255,255,255,0.2)"
                fontSize="8"
                fontFamily="'JetBrains Mono', monospace"
                dominantBaseline="central"
              >
                {val}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Legend row */}
      <div className="flex justify-center gap-4 mt-3">
        {AXES.map((axis, i) => (
          <div key={axis.key} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: colors[i] }}
            />
            <span className="text-[10px] text-gray-500 font-mono">
              {axis.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
