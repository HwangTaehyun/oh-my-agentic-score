"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ExportData, PeriodType, SessionMetrics } from "@/lib/types";
import { loadMetrics, getProjectName, filterByProject } from "@/lib/data";
import ChartProvider from "@/components/ChartProvider";
import ScoreCard from "@/components/ScoreCard";
import PeriodFilter from "@/components/PeriodFilter";
import RadarChart from "@/components/RadarChart";
import ThreadTypePieChart from "@/components/ThreadTypePieChart";
import TrendLineChart from "@/components/TrendLineChart";
import ToolCallBarChart from "@/components/ToolCallBarChart";
import SessionTable from "@/components/SessionTable";

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = decodeURIComponent(params.slug as string);
  const [data, setData] = useState<ExportData | null>(null);
  const [period, setPeriod] = useState<PeriodType>("weekly");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  useEffect(() => {
    loadMetrics().then(setData);
  }, []);

  if (!data) return <div className="text-gray-400 p-8">Loading...</div>;

  // Find project
  const project = data.projects.find((p) => p.project_hash === slug);
  if (!project)
    return <div className="text-red-400 p-8">Project not found: {slug}</div>;

  // Get sessions for this project
  const sessions = data.sessions.filter(
    (s) => s.project_path === project.project_path
  );

  const totalTools = sessions.reduce((s, x) => s + x.total_tool_calls, 0);
  const avgScore =
    sessions.length > 0
      ? sessions.reduce((s, x) => s + x.overall_score, 0) / sessions.length
      : 0;

  return (
    <ChartProvider>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {getProjectName(project.project_path)}
          </h1>
          <p className="text-sm text-gray-400 mt-1">{project.project_path}</p>
        </div>

        <PeriodFilter
          period={period}
          onPeriodChange={setPeriod}
          since={since}
          until={until}
          onSinceChange={setSince}
          onUntilChange={setUntil}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreCard title="Sessions" value={project.session_count} color="cyan" />
          <ScoreCard
            title="Tool Calls"
            value={totalTools.toLocaleString()}
            color="green"
          />
          <ScoreCard
            title="Avg Score"
            value={avgScore.toFixed(2)}
            color="purple"
          />
          <ScoreCard
            title="Main Type"
            value={project.dominant_thread_type}
            color="yellow"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RadarChart sessions={sessions} />
          <ThreadTypePieChart sessions={sessions} />
        </div>

        <TrendLineChart sessions={sessions} />
        <ToolCallBarChart sessions={sessions} period={period} />
        <SessionTable sessions={sessions} />
      </div>
    </ChartProvider>
  );
}
