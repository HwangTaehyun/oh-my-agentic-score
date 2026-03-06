"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExportData, PeriodType, ProjectSummary, SessionMetrics } from "@/lib/types";
import { loadMetrics, getProjectName, filterByProject, filterByPeriod, getPeriodSinceDate } from "@/lib/data";
import { parseISO } from "date-fns";
import ChartProvider from "@/components/ChartProvider";
import ScoreCard from "@/components/ScoreCard";
import PeriodFilter from "@/components/PeriodFilter";
import RadarChart from "@/components/RadarChart";
import ThreadTypePieChart from "@/components/ThreadTypePieChart";
import TrendLineChart from "@/components/TrendLineChart";
import ToolCallBarChart from "@/components/ToolCallBarChart";
import SessionTable from "@/components/SessionTable";

// ─── Project Detail View ────────────────────────────────────────────

function ProjectDetail({ data, slug }: { data: ExportData; slug: string }) {
  const [period, setPeriod] = useState<PeriodType>("weekly");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  const project = data.projects.find((p) => p.project_hash === slug);
  if (!project) return <div className="text-red-400 p-8">Project not found: {slug}</div>;

  // Filter sessions by period
  const filteredSessions = useMemo(() => {
    // First filter by project
    const projectSessions = data.sessions.filter((s) => s.project_path === project.project_path);

    // Then filter by period
    if (period === "all") {
      return projectSessions;
    }

    if (period === "custom") {
      const sinceDate = since ? parseISO(since) : undefined;
      const untilDate = until ? parseISO(until) : undefined;
      return filterByPeriod(projectSessions, sinceDate, untilDate);
    }

    // For predefined periods (daily, weekly, monthly, yearly)
    const sinceDate = getPeriodSinceDate(period);
    return filterByPeriod(projectSessions, sinceDate, undefined);
  }, [data.sessions, project.project_path, period, since, until]);

  const totalTools = filteredSessions.reduce((s, x) => s + x.total_tool_calls, 0);
  const avgScore = filteredSessions.length > 0
    ? filteredSessions.reduce((s, x) => s + x.overall_score, 0) / filteredSessions.length
    : 0;

  return (
    <ChartProvider>
      <div className="space-y-6">
        <div>
          <a href="/projects/" className="text-gray-400 hover:text-white text-sm">&larr; Back</a>
          <h1 className="text-2xl font-bold text-white mt-2">{getProjectName(project.project_path)}</h1>
          <p className="text-sm text-gray-400 mt-1">{project.project_path}</p>
        </div>

        <PeriodFilter
          period={period} onPeriodChange={setPeriod}
          since={since} until={until}
          onSinceChange={setSince} onUntilChange={setUntil}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreCard title="Sessions" value={filteredSessions.length} color="cyan" />
          <ScoreCard title="Tool Calls" value={totalTools.toLocaleString()} color="green" />
          <ScoreCard title="Avg Score" value={avgScore.toFixed(2)} color="purple" />
          <ScoreCard title="Main Type" value={project.dominant_thread_type} color="yellow" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <RadarChart sessions={filteredSessions} />
          <ThreadTypePieChart sessions={filteredSessions} />
        </div>

        <TrendLineChart sessions={filteredSessions} />
        <ToolCallBarChart sessions={filteredSessions} period={period} />
        <SessionTable sessions={filteredSessions} />
      </div>
    </ChartProvider>
  );
}

// ─── Project List View ──────────────────────────────────────────────

type SortDir = "desc" | "asc";

const HIDDEN_PROJECTS_KEY = "omas-hidden-projects";

function getHiddenProjects(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_PROJECTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistHiddenProjects(hashes: string[]) {
  localStorage.setItem(HIDDEN_PROJECTS_KEY, JSON.stringify(hashes));
}

function QualifiedInfoIcon({ excluded }: { excluded: number }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1.5 align-middle">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold cursor-help"
        style={{ background: "#2f2f2f", color: "#8a8a8a", border: "1px solid #444" }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        i
      </span>
      {show && (
        <span
          className="absolute left-6 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap text-[11px] font-mono px-3 py-2 rounded-md shadow-lg"
          style={{ background: "#1A1A1A", border: "1px solid #2f2f2f", color: "#ccc" }}
        >
          Only <span style={{ color: "#00FF88" }}>qualified</span> sessions are shown
          <br />
          (duration &ge; 5m, tool calls &ge; 10, human msgs &ge; 1)
          {excluded > 0 && (
            <span style={{ color: "#FFD600" }}>
              <br />{excluded} sessions excluded
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function ProjectsHero({ count, hiddenCount, comparison }: { count: number; hiddenCount: number; comparison?: { qualified_session_count: number; excluded_session_count: number } }) {
  return (
    <div>
      <p className="text-[11px] font-mono tracking-wider mb-2" style={{ color: "#00FF88", letterSpacing: "0.5px" }}>
        // PROJECT-LEVEL METRICS
      </p>
      <h1 className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>Projects</h1>
      <p className="text-sm font-mono mt-1" style={{ color: "#8a8a8a" }}>
        {count} projects tracked
        <QualifiedInfoIcon excluded={comparison?.excluded_session_count ?? 0} />
        {hiddenCount > 0 && <span style={{ color: "#666" }}> ({hiddenCount} hidden)</span>}
      </p>
    </div>
  );
}

function DimensionBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-14 font-mono" style={{ color }}>{label}</span>
      <div className="flex-1 h-1.5 overflow-hidden" style={{ background: "#1A1A1A", borderRadius: 3 }}>
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
      </div>
      <span className="w-8 text-right font-mono" style={{ color }}>{value.toFixed(1)}</span>
    </div>
  );
}

function ProjectCard({ project, onHide }: { project: ProjectSummary; onHide: (hash: string) => void }) {
  const p = project;
  return (
    <div className="relative group">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onHide(p.project_hash); }}
        className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-md bg-gray-800/80 text-gray-500 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all duration-150 cursor-pointer"
        title="Hide project"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </button>

      <Link
        href={`/projects/?slug=${encodeURIComponent(p.project_hash)}`}
        className="block rounded-lg p-5 hover:brightness-110 transition-all"
        style={{ background: "#0A0A0A", border: "1px solid #2f2f2f" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white truncate pr-6">{getProjectName(p.project_path)}</h3>
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-[11px]" style={{ color: "#8a8a8a" }}>
          <span>{p.session_count} sessions</span>
          <span className="font-semibold" style={{ color: "#00FF88" }}>Avg: {p.avg_overall_score.toFixed(2)}</span>
        </div>
        <div className="my-2.5" style={{ height: 1, background: "#2f2f2f" }} />
        <div className="space-y-2">
          <DimensionBar label="More" value={p.avg_parallelism_norm ?? p.avg_parallelism_score} max={10} color="#00FF88" />
          <DimensionBar label="Longer" value={p.avg_autonomy_norm ?? p.avg_autonomy_score} max={10} color="#FFD600" />
          <DimensionBar label="Thicker" value={p.avg_density_norm ?? p.avg_density_score} max={10} color="#FF6B35" />
          <DimensionBar label="Fewer" value={p.avg_trust_norm ?? p.avg_trust_score} max={10} color="#A855F7" />
        </div>
      </Link>
    </div>
  );
}

function SortToggle({ dir, onToggle }: { dir: SortDir; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-md transition-colors cursor-pointer"
      style={{ color: "#00FF88", background: "#1A1A1A", border: "1px solid #2f2f2f" }}
      title={dir === "desc" ? "Sorted: highest first" : "Sorted: lowest first"}
    >
      <span>Score</span>
      <svg width="10" height="12" viewBox="0 0 10 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {dir === "desc" ? <path d="M5 1v10M1 7l4 4 4-4" /> : <path d="M5 11V1M1 5l4-4 4 4" />}
      </svg>
    </button>
  );
}

export default function ProjectsPageWrapper() {
  return (
    <Suspense fallback={<div className="text-gray-400 p-8">Loading...</div>}>
      <ProjectsPage />
    </Suspense>
  );
}

function ProjectsPage() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug");

  const [data, setData] = useState<ExportData | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    loadMetrics().then(setData);
    setHidden(getHiddenProjects());
  }, []);

  const hideProject = useCallback((hash: string) => {
    setHidden((prev) => {
      const next = [...prev, hash];
      persistHiddenProjects(next);
      return next;
    });
  }, []);

  const restoreAll = useCallback(() => {
    setHidden([]);
    persistHiddenProjects([]);
  }, []);

  const toggleSort = useCallback(() => {
    setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
  }, []);

  const sortedProjects = useMemo(() => {
    if (!data) return [];
    const visible = data.projects.filter((p) => !hidden.includes(p.project_hash));
    const mul = sortDir === "desc" ? -1 : 1;
    return [...visible].sort((a, b) => mul * (a.avg_overall_score - b.avg_overall_score));
  }, [data, hidden, sortDir]);

  if (!data) {
    return <div className="text-gray-400 p-8">Loading...</div>;
  }

  // Detail mode
  if (slug) {
    return <ProjectDetail data={data} slug={slug} />;
  }

  // List mode
  const hiddenCount = data.projects.length - sortedProjects.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <ProjectsHero count={sortedProjects.length} hiddenCount={hiddenCount} comparison={data.comparison} />
        <div className="flex items-center gap-2">
          <SortToggle dir={sortDir} onToggle={toggleSort} />
          {hiddenCount > 0 && (
            <button
              onClick={restoreAll}
              className="text-[11px] font-mono px-3 py-1.5 rounded-md transition-colors"
              style={{ color: "#00FF88", background: "#1A1A1A", border: "1px solid #2f2f2f" }}
            >
              Restore {hiddenCount} hidden
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedProjects.map((p) => (
          <ProjectCard key={p.project_hash} project={p} onHide={hideProject} />
        ))}
      </div>
    </div>
  );
}
