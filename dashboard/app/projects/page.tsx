"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ExportData, ProjectSummary } from "@/lib/types";
import { loadMetrics, getProjectName } from "@/lib/data";

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

/** Pencil P7 hero section with green subtitle annotation. */
function ProjectsHero({ count, hiddenCount }: { count: number; hiddenCount: number }) {
  return (
    <div>
      <p className="text-xs font-mono tracking-wider mb-1" style={{ color: "#00FF88" }}>
        // PROJECT-LEVEL METRICS
      </p>
      <h1 className="text-4xl font-bold text-white tracking-tight">Projects</h1>
      <p className="text-sm text-gray-400 mt-1">
        {count} projects tracked
        {hiddenCount > 0 && (
          <span className="text-gray-500"> ({hiddenCount} hidden)</span>
        )}
      </p>
    </div>
  );
}

/** Single project card with dimension bars (Pencil P7 card style). */
function ProjectCard({
  project,
  onHide,
}: {
  project: ProjectSummary;
  onHide: (hash: string) => void;
}) {
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
        href={`/projects/${encodeURIComponent(p.project_hash)}`}
        className="block bg-gray-900 rounded-lg border border-gray-800 p-4 hover:border-cyan-500/50 transition-colors"
      >
        <h3 className="text-lg font-semibold text-white truncate pr-6">
          {getProjectName(p.project_path)}
        </h3>

        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <span>{p.session_count} sessions</span>
          <span className="font-mono" style={{ color: "#00FF88" }}>
            Avg: {p.avg_overall_score.toFixed(2)}
          </span>
        </div>

        <div className="border-t border-gray-800 my-3" />

        {/* Mini dimension bars — Pencil P7 card dimension rows */}
        <div className="space-y-1.5">
          <DimensionBar label="More" value={p.avg_parallelism_score} max={5} color="#00FF88" />
          <DimensionBar label="Longer" value={p.avg_autonomy_score} max={10} color="#FFD600" />
          <DimensionBar label="Thicker" value={p.avg_density_score} max={10} color="#FF6B35" />
          <DimensionBar label="Fewer" value={p.avg_trust_score} max={10} color="#A855F7" />
        </div>
      </Link>
    </div>
  );
}

/** Pencil P7 dimension bar with colored fill. */
function DimensionBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 font-mono" style={{ color }}>{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right font-mono" style={{ color }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export default function ProjectsPage() {
  const [data, setData] = useState<ExportData | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);

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

  if (!data) {
    return <div className="text-gray-400 p-8">Loading...</div>;
  }

  const visibleProjects = data.projects.filter((p) => !hidden.includes(p.project_hash));
  const hiddenCount = data.projects.length - visibleProjects.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <ProjectsHero count={visibleProjects.length} hiddenCount={hiddenCount} />
        {hiddenCount > 0 && (
          <button
            onClick={restoreAll}
            className="text-xs font-mono px-3 py-1.5 border border-gray-700 hover:border-cyan-500/50 rounded-md transition-colors"
            style={{ color: "#00FF88" }}
          >
            Restore {hiddenCount} hidden
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProjects.map((p) => (
          <ProjectCard key={p.project_hash} project={p} onHide={hideProject} />
        ))}
      </div>
    </div>
  );
}
