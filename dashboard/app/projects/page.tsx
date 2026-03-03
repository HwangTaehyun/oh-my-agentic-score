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
      <p className="text-[11px] font-mono tracking-wider mb-2" style={{ color: "#00FF88", letterSpacing: "0.5px" }}>
        // PROJECT-LEVEL METRICS
      </p>
      <h1 className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>Projects</h1>
      <p className="text-sm font-mono mt-1" style={{ color: "#8a8a8a" }}>
        {count} projects tracked
        {hiddenCount > 0 && (
          <span style={{ color: "#666" }}> ({hiddenCount} hidden)</span>
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
        className="block rounded-lg p-5 hover:brightness-110 transition-all"
        style={{ background: "#0A0A0A", border: "1px solid #2f2f2f" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white truncate pr-6">
            {getProjectName(p.project_path)}
          </h3>
        </div>

        <div className="flex items-center gap-4 mt-1.5 text-[11px]" style={{ color: "#8a8a8a" }}>
          <span>{p.session_count} sessions</span>
          <span className="font-semibold" style={{ color: "#00FF88" }}>
            Avg: {p.avg_overall_score.toFixed(2)}
          </span>
        </div>

        <div className="my-2.5" style={{ height: 1, background: "#2f2f2f" }} />

        {/* Dimension bars — Pencil P7 exact colors */}
        <div className="space-y-2">
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
    <div className="flex items-center gap-2 text-[10px]">
      <span className="w-14 font-mono" style={{ color }}>{label}</span>
      <div className="flex-1 h-1.5 overflow-hidden" style={{ background: "#1A1A1A", borderRadius: 3 }}>
        <div
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: color, borderRadius: 3 }}
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
            className="text-[11px] font-mono px-4 py-2 transition-colors"
            style={{ color: "#00FF88", background: "#1A1A1A", border: "1px solid #2f2f2f" }}
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
