"use client";

import { useEffect, useState } from "react";
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
import SessionTable from "@/components/SessionTable";

export default function SessionsPage() {
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

  // Apply filters
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
        {/* Hero — Pencil consistent */}
        <div>
          <p className="text-xs font-mono tracking-wider mb-1" style={{ color: "#00FF88" }}>
            // SESSION HISTORY
          </p>
          <h1 className="text-4xl font-bold text-white tracking-tight">Sessions</h1>
          <p className="text-sm text-gray-400 mt-1">
            {sessions.length} sessions across {projects.length} projects
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
        </div>

        {/* Session Table */}
        <SessionTable sessions={sessions} />
      </div>
    </ChartProvider>
  );
}
