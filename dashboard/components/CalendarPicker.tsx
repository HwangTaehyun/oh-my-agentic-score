"use client";

import { useState, useCallback } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  isWithinInterval,
} from "date-fns";

interface CalendarPickerProps {
  since: string;
  until: string;
  onSinceChange: (date: string) => void;
  onUntilChange: (date: string) => void;
}

type SelectionPhase = "start" | "end";

export default function CalendarPicker({
  since,
  until,
  onSinceChange,
  onUntilChange,
}: CalendarPickerProps) {
  const [currentMonth, setCurrentMonth] = useState(
    since ? new Date(since) : new Date()
  );
  const [phase, setPhase] = useState<SelectionPhase>(since ? "end" : "start");
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const sinceDate = since ? new Date(since) : null;
  const untilDate = until ? new Date(until) : null;

  const handleDateClick = useCallback(
    (date: Date) => {
      const formatted = format(date, "yyyy-MM-dd");

      if (phase === "start") {
        onSinceChange(formatted);
        onUntilChange("");
        setPhase("end");
      } else {
        // If clicked date is before the start date, reset
        if (sinceDate && isBefore(date, sinceDate)) {
          onSinceChange(formatted);
          onUntilChange("");
          setPhase("end");
        } else {
          onUntilChange(formatted);
          setPhase("start");
        }
      }
    },
    [phase, sinceDate, onSinceChange, onUntilChange]
  );

  const isInRange = (date: Date): boolean => {
    if (sinceDate && untilDate) {
      return isWithinInterval(date, { start: sinceDate, end: untilDate });
    }
    // Hover preview for range selection
    if (sinceDate && !untilDate && hoveredDate && phase === "end") {
      const start = isBefore(hoveredDate, sinceDate)
        ? hoveredDate
        : sinceDate;
      const end = isAfter(hoveredDate, sinceDate) ? hoveredDate : sinceDate;
      return isWithinInterval(date, { start, end });
    }
    return false;
  };

  const isStart = (date: Date) => sinceDate && isSameDay(date, sinceDate);
  const isEnd = (date: Date) => untilDate && isSameDay(date, untilDate);

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const weeks: Date[][] = [];
  let day = calStart;
  while (day <= calEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <span className="text-sm font-semibold text-gray-200 font-mono">
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Phase indicator */}
      <div className="flex gap-2 mb-3 text-[10px] font-mono">
        <span
          className={`px-2 py-0.5 rounded ${
            phase === "start"
              ? "bg-cyan-500/20 text-cyan-400"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          FROM: {since || "—"}
        </span>
        <span
          className={`px-2 py-0.5 rounded ${
            phase === "end"
              ? "bg-cyan-500/20 text-cyan-400"
              : "bg-gray-800 text-gray-500"
          }`}
        >
          TO: {until || "—"}
        </span>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {dayNames.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] text-gray-600 font-mono py-1"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0">
        {weeks.flat().map((date, i) => {
          const inMonth = isSameMonth(date, currentMonth);
          const selected = isStart(date) || isEnd(date);
          const inRange = isInRange(date);
          const isToday = isSameDay(date, new Date());

          return (
            <button
              key={i}
              onClick={() => handleDateClick(date)}
              onMouseEnter={() => setHoveredDate(date)}
              onMouseLeave={() => setHoveredDate(null)}
              className={`
                relative text-center text-xs py-1.5 transition-all
                ${!inMonth ? "text-gray-700" : "text-gray-300"}
                ${selected ? "bg-cyan-500 text-white font-bold rounded" : ""}
                ${
                  inRange && !selected
                    ? "bg-cyan-500/15 text-cyan-300"
                    : ""
                }
                ${
                  !selected && !inRange && inMonth
                    ? "hover:bg-gray-800 rounded"
                    : ""
                }
                ${isToday && !selected ? "ring-1 ring-cyan-500/40 rounded" : ""}
              `}
            >
              {format(date, "d")}
            </button>
          );
        })}
      </div>

      {/* Quick presets */}
      <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-800">
        {[
          { label: "Last 7d", days: 7 },
          { label: "Last 30d", days: 30 },
          { label: "Last 90d", days: 90 },
        ].map(({ label, days }) => (
          <button
            key={label}
            onClick={() => {
              const end = new Date();
              const start = addDays(end, -days);
              onSinceChange(format(start, "yyyy-MM-dd"));
              onUntilChange(format(end, "yyyy-MM-dd"));
              setPhase("start");
            }}
            className="text-[10px] px-2 py-1 rounded bg-gray-800 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 transition-colors font-mono"
          >
            {label}
          </button>
        ))}
        {(since || until) && (
          <button
            onClick={() => {
              onSinceChange("");
              onUntilChange("");
              setPhase("start");
            }}
            className="text-[10px] px-2 py-1 rounded bg-gray-800 text-red-400 hover:bg-red-500/10 transition-colors font-mono ml-auto"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
