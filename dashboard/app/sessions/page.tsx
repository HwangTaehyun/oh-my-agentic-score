"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ExportData, PeriodType, THREAD_COLORS } from "@/lib/types";
import type { SessionMetrics } from "@/lib/types";
import {
  loadMetrics,
  filterByPeriod,
  filterByProject,
  getUniqueProjects,
  getPeriodSinceDate,
  getProjectName,
} from "@/lib/data";
import ChartProvider from "@/components/ChartProvider";
import PeriodFilter from "@/components/PeriodFilter";
import ProjectFilter from "@/components/ProjectFilter";
import SessionTable from "@/components/SessionTable";
import RadarChart from "@/components/RadarChart";
import ScoreCard from "@/components/ScoreCard";
import ToolBreakdownChart from "@/components/ToolBreakdownChart";

// ─── Session Detail View ────────────────────────────────────────────

function DimensionCard({
  title,
  color,
  items,
}: {
  title: string;
  color: string;
  items: [string, string | number][];
}) {
  const borderColors: Record<string, string> = {
    cyan: "border-cyan-500/30",
    green: "border-green-500/30",
    red: "border-red-500/30",
    yellow: "border-yellow-500/30",
  };
  const textColors: Record<string, string> = {
    cyan: "text-cyan-400",
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className={`bg-gray-900 rounded-lg border ${borderColors[color]} p-4`}>
      <h3 className={`text-sm font-semibold ${textColors[color]} mb-3`}>{title}</h3>
      <div className="space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-gray-400">{label}</span>
            <span className="text-white font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionDetail({ session }: { session: SessionMetrics }) {
  return (
    <ChartProvider>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <a href="/sessions/" className="text-gray-400 hover:text-white text-sm">&larr; Back</a>
            <h1 className="text-2xl font-bold text-white">
              Session {session.session_id.slice(0, 8)}...
            </h1>
            <span
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: THREAD_COLORS[session.thread_type] + "22",
                color: THREAD_COLORS[session.thread_type],
              }}
            >
              {session.thread_type}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {getProjectName(session.project_path)} | {session.model} |{" "}
            {session.timestamp || "N/A"}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreCard title="Overall Score" value={session.overall_score.toFixed(2)} subtitle="out of 10" color="purple" />
          <ScoreCard title="Duration" value={`${session.session_duration_minutes.toFixed(0)}m`} color="cyan" />
          <ScoreCard title="Tool Calls" value={session.total_tool_calls} color="green" />
          <ScoreCard title="Human Messages" value={session.total_human_messages} color="yellow" />
        </div>

        <RadarChart sessions={[session]} />
        <ToolBreakdownChart sessions={[session]} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DimensionCard
            title="MORE (Parallelism)" color="cyan"
            items={[
              ["Concurrent Agents", session.parallelism.max_concurrent_agents],
              ["Total Sub-agents", session.parallelism.total_sub_agents],
              ["Peak Parallel Tools", session.parallelism.peak_parallel_tools],
              ["P-score", session.parallelism.p_thread_score.toFixed(1)],
            ]}
          />
          <DimensionCard
            title="LONGER (Autonomy)" color="green"
            items={[
              ["Autonomous Stretch", `${session.autonomy.longest_autonomous_stretch_minutes.toFixed(1)} min`],
              ["Max Tools Between Human", session.autonomy.max_tool_calls_between_human],
              ["Session Duration", `${session.autonomy.session_duration_minutes.toFixed(1)} min`],
              ["L-score", session.autonomy.l_thread_score.toFixed(1)],
            ]}
          />
          <DimensionCard
            title="THICKER (Density)" color="red"
            items={[
              ["Tool Calls/min", session.density.tool_calls_per_minute.toFixed(1)],
              ["Total Tool Calls", session.density.total_tool_calls],
              ["Sub-agent Depth", session.density.max_sub_agent_depth],
              ["Tokens/min", session.density.tokens_per_minute.toFixed(0)],
              ["B-score", session.density.b_thread_score.toFixed(1)],
            ]}
          />
          <DimensionCard
            title="FEWER (Trust)" color="yellow"
            items={[
              ["Tools/Human Msg", session.trust.tool_calls_per_human_message.toFixed(1)],
              ["Asst/Human Ratio", session.trust.assistant_per_human_ratio.toFixed(1)],
              ["Ask User Count", session.trust.ask_user_count],
              ["Autonomous %", `${session.trust.autonomous_tool_call_pct.toFixed(1)}%`],
              ["Z-score", session.trust.z_thread_score.toFixed(1)],
            ]}
          />
        </div>
      </div>
    </ChartProvider>
  );
}

// ─── Session List View ──────────────────────────────────────────────

export default function SessionsPageWrapper() {
  return (
    <Suspense fallback={<div className="text-gray-400 p-8">Loading...</div>}>
      <SessionsPage />
    </Suspense>
  );
}

function SessionsPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");

  const [data, setData] = useState<ExportData | null>(null);
  const [period, setPeriod] = useState<PeriodType>("all");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [project, setProject] = useState("");

  useEffect(() => {
    loadMetrics().then(setData);
  }, []);

  if (!data) {
    return <div className="text-gray-400 p-8">Loading...</div>;
  }

  // Detail mode: show single session
  if (sessionId) {
    const session = data.sessions.find((s) => s.session_id === sessionId);
    if (!session) return <div className="text-red-400 p-8">Session not found: {sessionId}</div>;
    return <SessionDetail session={session} />;
  }

  // List mode: apply filters
  let sessions = data.sessions;

  if (period === "all") {
    // No time filter
  } else if (period === "custom") {
    if (since) sessions = filterByPeriod(sessions, new Date(since));
    if (until) sessions = filterByPeriod(sessions, undefined, new Date(until));
  } else {
    const periodSince = getPeriodSinceDate(period);
    if (periodSince) sessions = filterByPeriod(sessions, periodSince);
  }

  if (project) sessions = filterByProject(sessions, project);

  const projects = getUniqueProjects(data.sessions);

  return (
    <ChartProvider>
      <div className="space-y-6">
        <div>
          <p className="text-[11px] font-mono tracking-wider mb-2" style={{ color: "#00FF88", letterSpacing: "0.5px" }}>
            // SESSION HISTORY
          </p>
          <h1 className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>Sessions</h1>
          <p className="text-sm font-mono mt-1" style={{ color: "#8a8a8a" }}>
            {sessions.length} sessions across {projects.length} projects
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <PeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            since={since}
            until={until}
            onSinceChange={setSince}
            onUntilChange={setUntil}
          />
          <ProjectFilter projects={projects} selected={project} onChange={setProject} />
        </div>

        <SessionTable sessions={sessions} />
      </div>
    </ChartProvider>
  );
}
