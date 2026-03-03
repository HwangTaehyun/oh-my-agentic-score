"use client";

interface ScoreCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  delay?: number;
}

export default function ScoreCard({
  title,
  value,
  subtitle,
  color = "cyan",
  delay = 0,
}: ScoreCardProps) {
  const borderColors: Record<string, string> = {
    cyan: "border-cyan-500/30 hover:border-cyan-500/60",
    green: "border-green-500/30 hover:border-green-500/60",
    red: "border-red-500/30 hover:border-red-500/60",
    yellow: "border-yellow-500/30 hover:border-yellow-500/60",
    purple: "border-purple-500/30 hover:border-purple-500/60",
  };

  const valueColors: Record<string, string> = {
    cyan: "text-cyan-400",
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    purple: "text-purple-400",
  };

  return (
    <div
      className={`bg-gray-900 rounded-lg border ${
        borderColors[color] || borderColors.cyan
      } p-4 card-hover animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
        {title}
      </p>
      <p
        className={`text-2xl font-bold font-mono mt-1.5 ${
          valueColors[color] || valueColors.cyan
        } animate-count-up`}
        style={{ animationDelay: `${delay + 200}ms` }}
      >
        {value}
      </p>
      {subtitle && (
        <p className="text-[10px] text-gray-600 mt-1 font-mono">{subtitle}</p>
      )}
    </div>
  );
}
