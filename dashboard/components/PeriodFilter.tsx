"use client";

import { useRef, useEffect, useState } from "react";
import { PeriodType } from "@/lib/types";
import CalendarPicker from "./CalendarPicker";

interface PeriodFilterProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  since?: string;
  until?: string;
  onSinceChange: (date: string) => void;
  onUntilChange: (date: string) => void;
}

const PERIODS: { value: PeriodType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const PERIOD_LABELS: Record<string, string> = {
  daily: "24h",
  weekly: "7 days",
  monthly: "30 days",
  yearly: "1 year",
};

/** Period pill toggle buttons */
function PeriodPills({ period, onChange }: { period: PeriodType; onChange: (p: PeriodType) => void }) {
  return (
    <div className="flex rounded-lg p-1" style={{ background: "#1A1A1A" }}>
      {PERIODS.map((p) => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1 rounded-md text-sm transition-colors ${
            period === p.value ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Custom date range summary button */
function CustomRangeButton({ since, until, onClick }: { since: string; until: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-gray-300 hover:border-cyan-500/50 transition-colors"
      style={{ background: "#1A1A1A", border: "1px solid #2f2f2f" }}
    >
      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <span className="font-mono text-xs">
        {since || "Start"} ~ {until || "End"}
      </span>
    </button>
  );
}

export default function PeriodFilter(props: PeriodFilterProps) {
  const { period, onPeriodChange, since = "", until = "", onSinceChange, onUntilChange } = props;
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCalendar) return;
    function handleClickOutside(e: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCalendar]);

  const handlePeriodChange = (p: PeriodType) => {
    onPeriodChange(p);
    setShowCalendar(p === "custom");
  };

  return (
    <div className="flex items-center gap-3 flex-wrap relative">
      <PeriodPills period={period} onChange={handlePeriodChange} />

      {period === "custom" && (
        <CustomRangeButton since={since} until={until} onClick={() => setShowCalendar(!showCalendar)} />
      )}

      {period === "custom" && showCalendar && (
        <div ref={calendarRef} className="absolute top-full left-0 mt-2 z-50">
          <CalendarPicker
            since={since}
            until={until}
            onSinceChange={onSinceChange}
            onUntilChange={(date) => { onUntilChange(date); if (date) setShowCalendar(false); }}
          />
        </div>
      )}

      {period !== "all" && period !== "custom" && PERIOD_LABELS[period] && (
        <span className="text-xs text-gray-500">Last {PERIOD_LABELS[period]}</span>
      )}
    </div>
  );
}
