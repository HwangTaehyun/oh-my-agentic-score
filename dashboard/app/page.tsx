"use client";

import { useEffect, useState, useMemo } from "react";
import { ExportData, PeriodType, SessionMetrics } from "@/lib/types";
import {
  loadMetrics,
  filterByPeriod,
  filterByProject,
  getUniqueProjects,
  getPeriodSinceDate,
} from "@/lib/data";
import ChartProvider from "@/components/ChartProvider";
import ScoreCard from "@/components/ScoreCard";
import PeriodFilter from "@/components/PeriodFilter";
import ProjectFilter from "@/components/ProjectFilter";
import DimensionRadar from "@/components/DimensionRadar";
import ThreadTypePieChart from "@/components/ThreadTypePieChart";
import TrendLineChart from "@/components/TrendLineChart";
import ToolCallBarChart from "@/components/ToolCallBarChart";
import ToolBreakdownChart from "@/components/ToolBreakdownChart";
import SessionTable from "@/components/SessionTable";

/** Session weight matching Cloud leaderboard: log1p(tool_calls) * log1p(duration_minutes) */
function sessionWeight(s: SessionMetrics): number {
  return Math.log1p(s.total_tool_calls) * Math.log1p(s.session_duration_minutes);
}

/** Compute summary statistics from filtered sessions (weighted average = Cloud formula). */
function computeStats(sessions: SessionMetrics[]) {
  const n = sessions.length;
  const totalTools = sessions.reduce((s, x) => s + x.total_tool_calls, 0);

  // Weighted average score (same as Cloud leaderboard composite_rank_score)
  const totalWeight = sessions.reduce((s, x) => s + sessionWeight(x), 0);
  const avgScore = totalWeight > 0
    ? sessions.reduce((s, x) => s + x.overall_score * sessionWeight(x), 0) / totalWeight
    : 0;

  const avgDuration = n > 0
    ? sessions.reduce((s, x) => s + x.session_duration_minutes, 0) / n
    : 0;
  const avgAutonomy = n > 0
    ? sessions.reduce((s, x) => s + x.autonomy.longest_autonomous_stretch_minutes, 0) / n
    : 0;
  return { totalTools, avgScore, avgDuration, avgAutonomy };
}

/** Apply period + project filters to sessions. */
function applyFilters(
  sessions: SessionMetrics[],
  period: PeriodType,
  since: string,
  until: string,
  project: string,
): SessionMetrics[] {
  let filtered = sessions;
  if (period === "custom") {
    if (since) filtered = filterByPeriod(filtered, new Date(since));
    if (until) filtered = filterByPeriod(filtered, undefined, new Date(until));
  } else if (period !== "all") {
    const periodSince = getPeriodSinceDate(period);
    if (periodSince) filtered = filterByPeriod(filtered, periodSince);
  }
  if (project) filtered = filterByProject(filtered, project);
  return filtered;
}

/** Pencil P6 hero section with green subtitle annotation. */
function OverviewHero({ totalSessions, excludedCount }: { totalSessions: number; excludedCount: number }) {
  return (
    <div>
      <p className="text-[11px] font-mono tracking-wider mb-2" style={{ color: "#00FF88", letterSpacing: "0.5px" }}>
        // THREAD-BASED ENGINEERING METRICS ({totalSessions} qualified sessions)
      </p>
      <h1 className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>Overview</h1>
      {excludedCount > 0 && (
        <p className="text-[11px] font-mono mt-2 px-3 py-1.5 rounded-md inline-block" style={{ color: "#FFD600", background: "#1A1A00", border: "1px solid #332D00" }}>
          {excludedCount} sessions excluded (requires: duration &ge; 5m, tool calls &ge; 10, human messages &ge; 1)
        </p>
      )}
    </div>
  );
}

/** 4 KPI score cards matching Pencil P6 statsRow. */
function StatsRow({
  sessions,
  projects,
  stats,
}: {
  sessions: SessionMetrics[];
  projects: string[];
  stats: ReturnType<typeof computeStats>;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <ScoreCard
        title="Total Sessions"
        value={sessions.length}
        subtitle={`${projects.length} projects`}
        color="cyan"
        delay={0}
      />
      <ScoreCard
        title="Total Tool Calls"
        value={stats.totalTools.toLocaleString()}
        subtitle={`${(stats.totalTools / Math.max(sessions.length, 1)).toFixed(0)} avg/session`}
        color="green"
        delay={100}
      />
      <ScoreCard
        title="Avg Score"
        value={stats.avgScore.toFixed(2)}
        subtitle="out of 10"
        color="purple"
        delay={200}
      />
      <ScoreCard
        title="Avg Autonomy"
        value={`${stats.avgAutonomy.toFixed(0)}m`}
        subtitle={`${stats.avgDuration.toFixed(0)}m avg duration`}
        color="yellow"
        delay={300}
      />
    </div>
  );
}

/** Charts + table section (Pencil P6 chartsRow + sessionTable). */
function OverviewCharts({
  sessions,
  period,
}: {
  sessions: SessionMetrics[];
  period: PeriodType;
}) {
  return (
    <>
      {/* Radar + Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="animate-fade-in-up delay-400">
          <DimensionRadar sessions={sessions} />
        </div>
        <div className="animate-fade-in-up delay-500">
          <ThreadTypePieChart sessions={sessions} />
        </div>
      </div>

      {/* Trend */}
      <div className="animate-fade-in-up delay-600">
        <TrendLineChart sessions={sessions} />
      </div>

      {/* Tool Calls + Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="animate-fade-in-up delay-700">
          <ToolCallBarChart sessions={sessions} period={period} />
        </div>
        <div className="animate-fade-in-up delay-700">
          <ToolBreakdownChart sessions={sessions} />
        </div>
      </div>

      {/* Sessions Table */}
      <div className="animate-fade-in-up delay-700">
        <SessionTable sessions={sessions} />
      </div>
    </>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<ExportData | null>(null);
  const [period, setPeriod] = useState<PeriodType>("all");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [project, setProject] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadMetrics()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const sessions = useMemo(
    () => (data ? applyFilters(data.sessions, period, since, until, project) : []),
    [data, period, since, until, project],
  );

  const projects = useMemo(
    () => (data ? getUniqueProjects(data.sessions) : []),
    [data],
  );

  const stats = useMemo(() => computeStats(sessions), [sessions]);

  if (error) {
    return (
      <div className="text-red-400 p-8">
        <h2 className="text-xl font-bold mb-2">Error loading data</h2>
        <p>{error}</p>
        <p className="text-sm text-gray-500 mt-2">
          Run: <code className="bg-gray-800 px-2 py-1 rounded">omas scan && omas export</code>
        </p>
      </div>
    );
  }

  if (!data) {
    return <div className="text-gray-400 p-8">Loading metrics...</div>;
  }

  return (
    <ChartProvider>
      <div className="space-y-6">
        <OverviewHero totalSessions={data.total_sessions} excludedCount={data.comparison?.excluded_session_count ?? 0} />

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
        </div>

        <StatsRow sessions={sessions} projects={projects} stats={stats} />
        {sessions.length === 0 && (
          <div className="text-center py-12 text-gray-500 font-mono text-sm">
            No sessions found for the selected period.
          </div>
        )}
        <OverviewCharts sessions={sessions} period={period} />
      </div>
    </ChartProvider>
  );
}
