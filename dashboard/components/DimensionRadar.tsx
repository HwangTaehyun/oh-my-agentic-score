"use client";

import { useMemo } from "react";
import { SessionMetrics, DIMENSION_COLORS } from "@/lib/types";

interface DimensionRadarProps {
  sessions: SessionMetrics[];
}

/* ── Chart geometry constants ── */
const SIZE = 380;
const CENTER = SIZE / 2;
const RADIUS = 140;
const GRID_LEVELS = 5;
const MAX_VALUE = 10;
const LABEL_OFFSET = RADIUS + 32;

/* ── 4 axes in diamond orientation: top → right → bottom → left ── */
const AXES = [
  { key: "more", label: "More", full: "Parallelism", angle: -Math.PI / 2 },
  { key: "longer", label: "Longer", full: "Autonomy", angle: 0 },
  { key: "thicker", label: "Thicker", full: "Density", angle: Math.PI / 2 },
  { key: "fewer", label: "Fewer", full: "Trust", angle: Math.PI },
] as const;

interface Vertex {
  x: number;
  y: number;
  value: number;
  color: string;
  key: string;
  label: string;
  full: string;
  angle: number;
}

/* ── Helpers ── */

function toXY(angle: number, r: number): [number, number] {
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function polygonPts(values: number[]): string {
  return AXES.map((axis, i) => {
    const ratio = Math.min(values[i] / MAX_VALUE, 1);
    const [x, y] = toXY(axis.angle, ratio * RADIUS);
    return `${x},${y}`;
  }).join(" ");
}

function gridPts(level: number): string {
  const ratio = level / GRID_LEVELS;
  return AXES.map((axis) => {
    const [x, y] = toXY(axis.angle, ratio * RADIUS);
    return `${x},${y}`;
  }).join(" ");
}

function computeRadarData(sessions: SessionMetrics[]) {
  const dimColors = [
    DIMENSION_COLORS.more,
    DIMENSION_COLORS.longer,
    DIMENSION_COLORS.thicker,
    DIMENSION_COLORS.fewer,
  ];

  if (!sessions.length) {
    return { values: [0, 0, 0, 0], overallAvg: 0, colors: dimColors };
  }

  const avg = (fn: (s: SessionMetrics) => number) =>
    sessions.reduce((sum, x) => sum + fn(x), 0) / sessions.length;

  const avgMore = avg((s) => Math.min(s.parallelism.p_thread_score * 2, 10));
  const avgLonger = avg((s) => s.autonomy.l_thread_score);
  const avgThicker = avg((s) => Math.min(s.density.b_thread_score, 10));
  const avgFewer = avg((s) => s.trust.z_thread_score);
  const vals = [avgMore, avgLonger, avgThicker, avgFewer];

  return {
    values: vals,
    overallAvg: vals.reduce((a, b) => a + b, 0) / 4,
    colors: dimColors,
  };
}

function buildVertices(values: number[], colors: string[]): Vertex[] {
  return AXES.map((axis, i) => {
    const ratio = Math.min(values[i] / MAX_VALUE, 1);
    const [x, y] = toXY(axis.angle, ratio * RADIUS);
    return { x, y, value: values[i], color: colors[i], ...axis };
  });
}

/* ── SVG sub-components ── */

function RadarDefs({ colors }: { colors: string[] }) {
  return (
    <defs>
      <filter id="radar-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      {colors.map((color, i) => (
        <filter key={`glow-${i}`} id={`dot-glow-${i}`} x="-100%" y="-100%" width="300%" height="300%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={color} floodOpacity="0.6" />
        </filter>
      ))}
      <radialGradient id="data-gradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.15" />
      </radialGradient>
    </defs>
  );
}

function RadarGrid() {
  return (
    <>
      {Array.from({ length: GRID_LEVELS }, (_, i) => {
        const level = GRID_LEVELS - i;
        return level % 2 === 0 ? null : (
          <polygon key={`band-${level}`} points={gridPts(level)} fill="rgba(255,255,255,0.025)" stroke="none" />
        );
      })}
      {Array.from({ length: GRID_LEVELS }, (_, i) => (
        <polygon
          key={`grid-${i + 1}`}
          points={gridPts(i + 1)}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={i + 1 === GRID_LEVELS ? 1.5 : 0.8}
        />
      ))}
      {AXES.map((axis, i) => {
        const [x, y] = toXY(axis.angle, RADIUS);
        return (
          <line key={`axis-${i}`} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" strokeDasharray="4,4" />
        );
      })}
    </>
  );
}

function RadarDataLayer({ dataPoints, vertices }: { dataPoints: string; vertices: Vertex[] }) {
  return (
    <>
      <polygon points={dataPoints} fill="url(#data-gradient)" stroke="#06B6D4" strokeWidth="2" strokeLinejoin="round" filter="url(#radar-glow)" className="animate-radar-fill" />
      {vertices.map((v, i) => {
        const next = vertices[(i + 1) % vertices.length];
        return (
          <polygon key={`tri-${i}`} points={`${CENTER},${CENTER} ${v.x},${v.y} ${next.x},${next.y}`} fill={v.color} fillOpacity="0.08" stroke="none" />
        );
      })}
      {vertices.map((v, i) => (
        <g key={`dot-${i}`}>
          <circle cx={v.x} cy={v.y} r="8" fill={v.color} fillOpacity="0.15" />
          <circle cx={v.x} cy={v.y} r="5" fill={v.color} filter={`url(#dot-glow-${i})`} />
          <circle cx={v.x} cy={v.y} r="2" fill="#ffffff" fillOpacity="0.7" />
        </g>
      ))}
      <circle cx={CENTER} cy={CENTER} r="3" fill="rgba(255,255,255,0.2)" />
    </>
  );
}

function RadarLabels({ vertices, values, colors }: { vertices: Vertex[]; values: number[]; colors: string[] }) {
  return (
    <>
      {AXES.map((axis, i) => {
        const [lx, ly] = toXY(axis.angle, LABEL_OFFSET);
        const isTop = axis.angle === -Math.PI / 2;
        const isBottom = axis.angle === Math.PI / 2;
        const isLeft = axis.angle === Math.PI;
        const isRight = axis.angle === 0;
        const anchor = isLeft ? "end" : isRight ? "start" : "middle";
        const yOff = isTop ? -8 : isBottom ? 8 : 0;

        return (
          <g key={`label-${i}`}>
            <text x={lx} y={ly + yOff} textAnchor={anchor} dominantBaseline="central" fill={colors[i]} fontSize="13" fontWeight="700" fontFamily="'Space Grotesk', system-ui, sans-serif">
              {axis.label}
            </text>
            <text x={lx} y={ly + yOff + (isTop ? -16 : 16)} textAnchor={anchor} dominantBaseline="central" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="'JetBrains Mono', monospace">
              {axis.full}
            </text>
            <text
              x={vertices[i].x + (isLeft ? -14 : isRight ? 14 : 0)}
              y={vertices[i].y + (isTop ? -14 : isBottom ? 14 : -12)}
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
      {Array.from({ length: GRID_LEVELS }, (_, i) => {
        const level = i + 1;
        const [, y] = toXY(-Math.PI / 2, (level / GRID_LEVELS) * RADIUS);
        return (
          <text key={`scale-${level}`} x={CENTER + 8} y={y} fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="'JetBrains Mono', monospace" dominantBaseline="central">
            {(level / GRID_LEVELS) * MAX_VALUE}
          </text>
        );
      })}
    </>
  );
}

/** Pencil P6: 4 colored dimension score badges below radar */
function DimensionBadges({ values, colors }: { values: number[]; colors: string[] }) {
  return (
    <div className="grid grid-cols-4 gap-2 mt-4">
      {AXES.map((axis, i) => (
        <div
          key={axis.key}
          className="rounded-md p-2 text-center"
          style={{ backgroundColor: colors[i] + "15" }}
        >
          <div className="text-[10px] font-mono" style={{ color: colors[i] + "99" }}>
            {axis.label}
          </div>
          <div className="text-base font-bold font-mono" style={{ color: colors[i] }}>
            {values[i].toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
}

function RadarLegend({ colors }: { colors: string[] }) {
  return (
    <div className="flex justify-center gap-4 mt-3">
      {AXES.map((axis, i) => (
        <div key={axis.key} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i] }} />
          <span className="text-[10px] text-gray-500 font-mono">{axis.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Main component ── */

export default function DimensionRadar({ sessions }: DimensionRadarProps) {
  const { values, overallAvg, colors } = useMemo(() => computeRadarData(sessions), [sessions]);
  const dataPoints = polygonPts(values);
  const vertices = buildVertices(values, colors);

  return (
    <div className="rounded-lg p-5" style={{ background: "#0A0A0A", border: "1px solid #2f2f2f" }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-300">4-Dimension Radar</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">OVERALL</span>
          <span className="text-lg font-bold font-mono" style={{ color: "#00FF88" }}>{overallAvg.toFixed(1)}</span>
          <span className="text-[10px] text-gray-600 font-mono">/ 10</span>
        </div>
      </div>

      <div className="flex justify-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[380px]" style={{ overflow: "visible" }}>
          <RadarDefs colors={colors} />
          <RadarGrid />
          <RadarDataLayer dataPoints={dataPoints} vertices={vertices} />
          <RadarLabels vertices={vertices} values={values} colors={colors} />
        </svg>
      </div>

      <DimensionBadges values={values} colors={colors} />
      <RadarLegend colors={colors} />
    </div>
  );
}
