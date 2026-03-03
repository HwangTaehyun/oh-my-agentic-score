"use client";

import { getProjectName } from "@/lib/data";

interface ProjectFilterProps {
  projects: string[];
  selected: string;
  onChange: (project: string) => void;
}

export default function ProjectFilter({
  projects,
  selected,
  onChange,
}: ProjectFilterProps) {
  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md px-3 py-1.5 text-sm text-gray-300"
      style={{ background: "#1A1A1A", border: "1px solid #2f2f2f" }}
    >
      <option value="">All Projects</option>
      {projects.map((p) => (
        <option key={p} value={p}>
          {getProjectName(p)}
        </option>
      ))}
    </select>
  );
}
