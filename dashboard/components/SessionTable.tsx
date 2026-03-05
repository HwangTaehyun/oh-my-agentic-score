"use client";

import Link from "next/link";
import { SessionMetrics, THREAD_COLORS } from "@/lib/types";
import { getProjectName } from "@/lib/data";
import { parseISO, format } from "date-fns";
import { useState } from "react";

type SortKey = "timestamp" | "total_tool_calls" | "overall_score" | "session_duration_minutes";

const CARD_STYLE = { background: "#0A0A0A", border: "1px solid #2f2f2f" };

/** Sort sessions by a given key and direction. */
function sortSessions(sessions: SessionMetrics[], sortKey: SortKey, sortDesc: boolean) {
  return [...sessions].sort((a, b) => {
    const valMap: Record<SortKey, (s: SessionMetrics) => number> = {
      timestamp: (s) => (s.timestamp ? new Date(s.timestamp).getTime() : 0),
      total_tool_calls: (s) => s.total_tool_calls,
      overall_score: (s) => s.overall_score,
      session_duration_minutes: (s) => s.session_duration_minutes,
    };
    const fn = valMap[sortKey];
    return sortDesc ? fn(b) - fn(a) : fn(a) - fn(b);
  });
}

function SortHeader({ label, field, sortKey, sortDesc, onSort }: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  sortDesc: boolean;
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
      onClick={() => onSort(field)}
    >
      {label} {sortKey === field ? (sortDesc ? "▼" : "▲") : ""}
    </th>
  );
}

function SessionRow({ s }: { s: SessionMetrics }) {
  return (
    <tr key={s.session_id} className="hover:brightness-125">
      <td className="px-3 py-2 text-gray-300">
        <Link href={`/sessions/?id=${s.session_id}`} className="hover:text-cyan-400">
          {s.timestamp ? format(parseISO(s.timestamp), "MM/dd HH:mm") : "N/A"}
        </Link>
      </td>
      <td className="px-3 py-2 text-gray-400">{getProjectName(s.project_path)}</td>
      <td className="px-3 py-2">
        <span
          className="px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: THREAD_COLORS[s.thread_type] + "22", color: THREAD_COLORS[s.thread_type] }}
        >
          {s.thread_type}
        </span>
      </td>
      <td className="px-3 py-2 text-gray-300">{s.session_duration_minutes.toFixed(0)}m</td>
      <td className="px-3 py-2 text-cyan-400 font-mono">{s.total_tool_calls}</td>
      <td className="px-3 py-2 text-gray-400">{s.total_human_messages}</td>
      <td className="px-3 py-2 font-mono font-bold text-white">{s.overall_score.toFixed(2)}</td>
    </tr>
  );
}

export default function SessionTable({ sessions, limit = 50 }: { sessions: SessionMetrics[]; limit?: number }) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const sorted = sortSessions(sessions, sortKey, sortDesc);
  const headerProps = { sortKey, sortDesc, onSort: handleSort };

  return (
    <div className="rounded-lg overflow-hidden" style={CARD_STYLE}>
      <div className="p-4" style={{ borderBottom: "1px solid #2f2f2f" }}>
        <h3 className="text-sm font-semibold text-gray-300">Sessions ({sessions.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: "#1A1A1A" }}>
            <tr>
              <SortHeader label="Date" field="timestamp" {...headerProps} />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Project</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Type</th>
              <SortHeader label="Duration" field="session_duration_minutes" {...headerProps} />
              <SortHeader label="Tool Calls" field="total_tool_calls" {...headerProps} />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">Human</th>
              <SortHeader label="Score" field="overall_score" {...headerProps} />
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "#2f2f2f" }}>
            {sorted.slice(0, limit).map((s) => (
              <SessionRow key={s.session_id} s={s} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
