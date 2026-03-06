"use client";

import { useEffect, useState, useMemo } from "react";
import { ExportData, PeriodType } from "@/lib/types";
import {
  loadMetrics,
  filterByPeriod,
  filterByProject,
  getUniqueProjects,
  getPeriodSinceDate,
} from "@/lib/data";
import ChartProvider from "@/components/ChartProvider";
import PeriodFilter from "@/components/PeriodFilter";
import ProjectFilter from "@/components/ProjectFilter";
import ToolCallBarChart from "@/components/ToolCallBarChart";
import ToolBreakdownChart from "@/components/ToolBreakdownChart";

export default function ToolUsagePage() {
  const [data, setData] = useState<ExportData | null>(null);
  const [period, setPeriod] = useState<PeriodType>("all");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [project, setProject] = useState("");

  useEffect(() => {
    loadMetrics().then(setData).catch((e) => console.error("Failed to load metrics:", e));
  }, []);

  if (!data) {
    return <div className="text-gray-400 p-8">Loading...</div>;
  }

  return (
    <ToolUsageContent
      data={data}
      period={period}
      setPeriod={setPeriod}
      since={since}
      setSince={setSince}
      until={until}
      setUntil={setUntil}
      project={project}
      setProject={setProject}
    />
  );
}

function ToolUsageContent({
  data,
  period,
  setPeriod,
  since,
  setSince,
  until,
  setUntil,
  project,
  setProject,
}: {
  data: ExportData;
  period: PeriodType;
  setPeriod: (p: PeriodType) => void;
  since: string;
  setSince: (s: string) => void;
  until: string;
  setUntil: (u: string) => void;
  project: string;
  setProject: (p: string) => void;
}) {
  const sessions = useMemo(() => {
    let filtered = data.sessions;

    if (period === "all") {
      // No time filter
    } else if (period === "custom") {
      if (since) filtered = filterByPeriod(filtered, new Date(since));
      if (until) filtered = filterByPeriod(filtered, undefined, new Date(until));
    } else {
      const periodSince = getPeriodSinceDate(period);
      if (periodSince) filtered = filterByPeriod(filtered, periodSince);
    }

    if (project) filtered = filterByProject(filtered, project);

    return filtered;
  }, [data, period, since, until, project]);

  const projects = useMemo(() => getUniqueProjects(data.sessions), [data.sessions]);

  // Compute tool stats
  const totalTools = useMemo(() => sessions.reduce((s, x) => s + x.total_tool_calls, 0), [sessions]);
  const avgToolsPerSession = sessions.length > 0 ? Math.round(totalTools / sessions.length) : 0;

  // Aggregate tool types
  const toolTypeCount = useMemo(() => {
    const toolTypes = new Set<string>();
    for (const s of sessions) {
      if (s.tool_breakdown) {
        for (const key of Object.keys(s.tool_breakdown)) {
          toolTypes.add(key);
        }
      }
    }
    return toolTypes.size;
  }, [sessions]);

  return (
    <ChartProvider>
      <div className="space-y-6">
        {/* Hero */}
        <div>
          <p className="text-[11px] font-mono tracking-wider mb-2" style={{ color: "#00FF88", letterSpacing: "0.5px" }}>
            // TOOL ANALYTICS
          </p>
          <h1 className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>Tool Usage</h1>
          <p className="text-sm font-mono mt-1" style={{ color: "#8a8a8a" }}>
            Per-tool breakdown across {sessions.length} sessions
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <PeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            since={since}
            until={until}
            onSinceChange={setSince}
            onUntilChange={setUntil}
          />
          <ProjectFilter
            projects={projects}
            selected={project}
            onChange={setProject}
          />
          <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
            <span>{totalTools.toLocaleString()} total calls</span>
            <span>{avgToolsPerSession} avg/session</span>
            <span>{toolTypeCount} tool types</span>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center py-12 text-gray-500 font-mono text-sm">
            No sessions found for the selected period.
          </div>
        ) : (
          /* Charts — 2-column layout */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ToolCallBarChart sessions={sessions} period={period} />
            <ToolBreakdownChart sessions={sessions} />
          </div>
        )}
      </div>
    </ChartProvider>
  );
}
