export type ThreadType =
  | "Base"
  | "P-thread"
  | "C-thread"
  | "F-thread"
  | "B-thread"
  | "L-thread"
  | "Z-thread";

export interface ParallelismMetrics {
  max_concurrent_agents: number;
  total_sub_agents: number;
  peak_parallel_tools: number;
  p_thread_score: number;
}

export interface AutonomyMetrics {
  longest_autonomous_stretch_minutes: number;
  max_tool_calls_between_human: number;
  session_duration_minutes: number;
  max_consecutive_assistant_turns: number;
  l_thread_score: number;
}

export interface DensityMetrics {
  tool_calls_per_minute: number;
  max_sub_agent_depth: number;
  total_tool_calls: number;
  tokens_per_minute: number;
  b_thread_score: number;
  ai_written_lines: number;
  ai_line_bonus: number;
}

export interface TrustMetrics {
  tool_calls_per_human_message: number;
  assistant_per_human_ratio: number;
  ask_user_count: number;
  plan_mode_ask_user_count?: number;
  penalized_ask_user_count?: number;
  autonomous_tool_call_pct: number;
  z_thread_score: number;
  // Trivial delegation: human msgs followed by ≤ TRIVIAL_DELEGATION_THRESHOLD tool calls
  trivial_delegation_count: number;
  effective_human_count: number;
}

export interface SessionMetrics {
  session_id: string;
  project_path: string;
  project_hash: string;
  timestamp: string | null;
  model: string;
  thread_type: ThreadType;
  session_duration_minutes: number;
  total_tool_calls: number;
  total_human_messages: number;
  parallelism: ParallelismMetrics;
  autonomy: AutonomyMetrics;
  density: DensityMetrics;
  trust: TrustMetrics;
  tool_breakdown: Record<string, number>;
  ai_written_lines: number;
  overall_score: number;
}

export interface ProjectSummary {
  project_path: string;
  project_hash: string;
  session_count: number;
  total_tool_calls: number;
  // Raw dimension averages
  avg_parallelism_score: number;
  avg_autonomy_score: number;
  avg_density_score: number;
  avg_trust_score: number;
  // Normalized dimension averages (0-10 scale, matches overall_score formula)
  avg_parallelism_norm: number;
  avg_autonomy_norm: number;
  avg_density_norm: number;
  avg_trust_norm: number;
  avg_overall_score: number;
  dominant_thread_type: ThreadType;
  thread_type_distribution: Record<string, number>;
  sessions: string[];
}

export interface ExportData {
  generated_at: string;
  total_sessions: number;
  sessions: SessionMetrics[];
  projects: ProjectSummary[];
  comparison?: ComparisonMetrics;
}

export interface ComparisonMetrics {
  qualified_session_count: number;
  excluded_session_count: number;
  weighted_overall_score: number;
  consistency_score: number;
  composite_rank_score: number;
}

export type PeriodType = "all" | "daily" | "weekly" | "monthly" | "yearly" | "custom";

export const THREAD_COLORS: Record<ThreadType, string> = {
  Base: "#6B7280",
  "P-thread": "#06B6D4",
  "C-thread": "#EAB308",
  "F-thread": "#A855F7",
  "B-thread": "#EF4444",
  "L-thread": "#22C55E",
  "Z-thread": "#10B981",
};

export const DIMENSION_COLORS = {
  more: "#06B6D4",
  longer: "#22C55E",
  thicker: "#EF4444",
  fewer: "#EAB308",
};

/** Color palette for tool categories in the breakdown chart. */
export const TOOL_CATEGORY_COLORS: Record<string, string> = {
  Read: "#3B82F6",       // blue
  Write: "#8B5CF6",      // violet
  Edit: "#A855F7",       // purple
  Bash: "#F97316",       // orange
  Glob: "#06B6D4",       // cyan
  Grep: "#14B8A6",       // teal
  Agent: "#EF4444",      // red
  Skill: "#EC4899",      // pink
  AskUserQuestion: "#EAB308", // yellow
  WebFetch: "#22C55E",   // green
  WebSearch: "#10B981",  // emerald
  EnterPlanMode: "#6366F1", // indigo
  ExitPlanMode: "#818CF8",  // indigo light
  TodoWrite: "#F59E0B",  // amber
  MCP: "#64748B",        // slate (grouped MCP tools)
  Other: "#9CA3AF",      // gray
};
