"use client";

import Link from "next/link";
import { SessionMetrics, THREAD_COLORS } from "@/lib/types";
import { getProjectName } from "@/lib/data";
import { parseISO, format } from "date-fns";
import { useState } from "react";

interface SessionTableProps {
  sessions: SessionMetrics[];
  limit?: number;
}

type SortKey = "timestamp" | "total_tool_calls" | "overall_score" | "session_duration_minutes";

export default function SessionTable({ sessions, limit = 50 }: SessionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = [...sessions].sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sortKey) {
      case "timestamp":
        aVal = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        bVal = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        break;
      case "total_tool_calls":
        aVal = a.total_tool_calls;
        bVal = b.total_tool_calls;
        break;
      case "overall_score":
        aVal = a.overall_score;
        bVal = b.overall_score;
        break;
      case "session_duration_minutes":
        aVal = a.session_duration_minutes;
        bVal = b.session_duration_minutes;
        break;
      default:
        return 0;
    }
    return sortDesc ? bVal - aVal : aVal - bVal;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white"
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortDesc ? "▼" : "▲") : ""}
    </th>
  );

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300">
          Sessions ({sessions.length})
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              <SortHeader label="Date" field="timestamp" />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                Project
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                Type
              </th>
              <SortHeader label="Duration" field="session_duration_minutes" />
              <SortHeader label="Tool Calls" field="total_tool_calls" />
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                Human
              </th>
              <SortHeader label="Score" field="overall_score" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {sorted.slice(0, limit).map((s) => (
              <tr key={s.session_id} className="hover:bg-gray-800/50">
                <td className="px-3 py-2 text-gray-300">
                  <Link
                    href={`/sessions/${s.session_id}`}
                    className="hover:text-cyan-400"
                  >
                    {s.timestamp
                      ? format(parseISO(s.timestamp), "MM/dd HH:mm")
                      : "N/A"}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-400">
                  {getProjectName(s.project_path)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: THREAD_COLORS[s.thread_type] + "22",
                      color: THREAD_COLORS[s.thread_type],
                    }}
                  >
                    {s.thread_type}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-300">
                  {s.session_duration_minutes.toFixed(0)}m
                </td>
                <td className="px-3 py-2 text-cyan-400 font-mono">
                  {s.total_tool_calls}
                </td>
                <td className="px-3 py-2 text-gray-400">{s.total_human_messages}</td>
                <td className="px-3 py-2 font-mono font-bold text-white">
                  {s.overall_score.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
