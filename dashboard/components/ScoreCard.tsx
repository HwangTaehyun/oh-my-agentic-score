"use client";

interface ScoreCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  delay?: number;
}

const BORDER_COLORS: Record<string, string> = {
  cyan: "#06B6D4",
  green: "#00FF88",
  red: "#EF4444",
  yellow: "#FFD600",
  purple: "#A855F7",
};

const VALUE_COLORS: Record<string, string> = {
  cyan: "#22D3EE",
  green: "#4ADE80",
  red: "#F87171",
  yellow: "#FACC15",
  purple: "#C084FC",
};

export default function ScoreCard({ title, value, subtitle, color = "cyan", delay = 0 }: ScoreCardProps) {
  const borderColor = BORDER_COLORS[color] || BORDER_COLORS.cyan;
  const valueColor = VALUE_COLORS[color] || VALUE_COLORS.cyan;

  return (
    <div
      className="rounded-lg p-4 card-hover animate-fade-in-up"
      style={{
        background: "#0A0A0A",
        border: `1px solid ${borderColor}30`,
        animationDelay: `${delay}ms`,
      }}
    >
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">{title}</p>
      <p
        className="text-2xl font-bold font-mono mt-1.5 animate-count-up"
        style={{ color: valueColor, animationDelay: `${delay + 200}ms` }}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] text-gray-600 mt-1 font-mono">{subtitle}</p>
      )}
    </div>
  );
}
