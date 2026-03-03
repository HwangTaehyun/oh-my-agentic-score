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
      className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-300"
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
