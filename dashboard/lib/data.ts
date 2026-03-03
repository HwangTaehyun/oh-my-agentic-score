import { ExportData, SessionMetrics, PeriodType } from "./types";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  isAfter,
  isBefore,
  parseISO,
  format,
} from "date-fns";

let cachedData: ExportData | null = null;

export async function loadMetrics(): Promise<ExportData> {
  if (cachedData) return cachedData;

  const res = await fetch("/data/metrics.json");
  if (!res.ok) {
    throw new Error(`Failed to load metrics: ${res.statusText}`);
  }
  cachedData = await res.json();
  return cachedData!;
}

export function filterByPeriod(
  sessions: SessionMetrics[],
  since?: Date,
  until?: Date
): SessionMetrics[] {
  return sessions.filter((s) => {
    if (!s.timestamp) return false;
    const ts = parseISO(s.timestamp);
    if (since && isBefore(ts, since)) return false;
    if (until && isAfter(ts, until)) return false;
    return true;
  });
}

export function filterByProject(
  sessions: SessionMetrics[],
  projectPath?: string
): SessionMetrics[] {
  if (!projectPath) return sessions;
  return sessions.filter((s) => s.project_path === projectPath);
}

export function groupByPeriod(
  sessions: SessionMetrics[],
  period: PeriodType
): Map<string, SessionMetrics[]> {
  const groups = new Map<string, SessionMetrics[]>();

  for (const session of sessions) {
    if (!session.timestamp) continue;
    const ts = parseISO(session.timestamp);
    let key: string;

    switch (period) {
      case "daily":
        key = format(startOfDay(ts), "yyyy-MM-dd");
        break;
      case "weekly":
        key = format(startOfWeek(ts), "yyyy-MM-dd");
        break;
      case "monthly":
        key = format(startOfMonth(ts), "yyyy-MM");
        break;
      case "yearly":
        key = format(startOfYear(ts), "yyyy");
        break;
      case "all":
        key = format(startOfMonth(ts), "yyyy-MM");
        break;
      default:
        key = format(startOfDay(ts), "yyyy-MM-dd");
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(session);
  }

  return groups;
}

export function getProjectName(projectPath: string): string {
  if (!projectPath) return "Unknown";
  const parts = projectPath.split("/");
  return parts[parts.length - 1] || parts[parts.length - 2] || projectPath;
}

export function getUniqueProjects(sessions: SessionMetrics[]): string[] {
  const projects = new Set(sessions.map((s) => s.project_path).filter(Boolean));
  return Array.from(projects).sort();
}

/**
 * Get the "since" date for a given period type.
 * Returns undefined for "custom" (user sets dates manually).
 */
export function getPeriodSinceDate(period: PeriodType): Date | undefined {
  const now = new Date();
  switch (period) {
    case "daily":
      return subDays(now, 1);
    case "weekly":
      return subWeeks(now, 1);
    case "monthly":
      return subMonths(now, 1);
    case "yearly":
      return subYears(now, 1);
    case "all":
    case "custom":
      return undefined;
  }
}
