/** Static data for the Scoring Guide page (Pencil P8). Bilingual: EN + KO. */

export type Lang = "en" | "ko";

export interface FormulaLine { code: string; comment: string | null; }
export interface RefRow { input: string; score: string; }
export interface MetricDef { name: string; desc: string; }
export interface ScoreRange { range: string; meaning: string; }

export interface ExampleDef { title: string; lines: string[]; result: string; }

export interface DimensionConfig {
  title: string;
  subtitle: string;
  color: string;
  accentHex: string;
  maxScore: string;
  formulaTitle: string;
  formula: FormulaLine[];
  /** Highlighted box: what it takes to reach 10/10. */
  fullScoreNote?: string;
  detailTitle: string;
  detail: string[];
  referenceTable?: { title: string; rows: RefRow[] };
  examples?: ExampleDef[];
  metrics: MetricDef[];
  scoring: ScoreRange[];
  tips: string[];
}

export interface ThreadTypeDef { type: string; color: string; condition: string; desc: string; }
export interface RoadmapStepDef { from: string; to: string; tip: string; }

/* ── Page-level labels ── */

export const PAGE_LABELS: Record<Lang, {
  heroSub: string; heroTitle: string; heroDesc: string;
  overallLabel: string; overallFormula: string; overallNote: string;
  threadTitle: string; threadDesc: string;
  roadmapTitle: string; roadmapDesc: string;
  fairTitle: string; fairDesc: string;
  thresholdTitle: string; thresholdDesc: string;
  weightedTitle: string; weightedDesc: string;
  consistencyTitle: string; consistencyDesc: string;
  compositeTitle: string; compositeDesc: string;
  dataSourceTitle: string;
}> = {
  en: {
    heroSub: "// HOW SCORES ARE CALCULATED",
    heroTitle: "Scoring Guide",
    heroDesc: "Thread-based engineering metrics across 4 dimensions",
    overallLabel: "OVERALL COMPOSITE SCORE",
    overallFormula: "overall = (p_thread_score + l_thread_score + b_thread_score + z_thread_score) / 4",
    overallNote: "Each dimension score is 0-10 (capped). The overall score is the simple average. All four *_thread_score values are used directly — no additional normalization.",
    threadTitle: "Thread Type Classification",
    threadDesc: "Sessions are classified into one type using the following priority order (Z is highest):",
    roadmapTitle: "Improvement Roadmap",
    roadmapDesc: "Evolve in order: Base → C → P → L → B → Z. Key strategies for each step:",
    fairTitle: "Fair Comparison System",
    fairDesc: "A system that filters and weights sessions for fair comparison. Prevents short test sessions or automation scripts from skewing overall scores.",
    thresholdTitle: "Minimum Qualifying Thresholds",
    thresholdDesc: "All criteria below must be met to be included in comparisons.",
    weightedTitle: "Weighted Scoring",
    weightedDesc: "Longer and more complex sessions receive proportionally higher weight.",
    consistencyTitle: "Consistency Score (0~10)",
    consistencyDesc: "Measures consistency based on standard deviation of overall scores from the last 20 sessions.",
    compositeTitle: "Composite Rank Score",
    compositeDesc: "Final comparison rank score combining weighted score (80%) and consistency score (20%).",
    dataSourceTitle: "Data Source",
  },
  ko: {
    heroSub: "// HOW SCORES ARE CALCULATED",
    heroTitle: "Scoring Guide",
    heroDesc: "Thread-based engineering metrics across 4 dimensions",
    overallLabel: "OVERALL COMPOSITE SCORE",
    overallFormula: "overall = (p_thread_score + l_thread_score + b_thread_score + z_thread_score) / 4",
    overallNote: "각 차원 점수는 0-10 (cap). 전체 점수는 4개의 단순 평균입니다. 4개의 *_thread_score 값이 직접 사용되며, 추가 정규화는 없습니다.",
    threadTitle: "Thread Type Classification",
    threadDesc: "세션은 아래 우선순위 순서로 한 가지 유형으로 분류됩니다 (Z가 가장 높은 우선순위):",
    roadmapTitle: "Improvement Roadmap",
    roadmapDesc: "Base → C → P → L → B → Z 순서로 진화하세요. 각 단계별 핵심 전략:",
    fairTitle: "Fair Comparison System",
    fairDesc: "공정한 비교를 위해 세션을 필터링하고 가중치를 부여하는 시스템입니다. 짧은 테스트 세션이나 자동화 스크립트가 전체 점수를 왜곡하지 않도록 합니다.",
    thresholdTitle: "Minimum Qualifying Thresholds",
    thresholdDesc: "아래 기준을 모두 충족해야 비교 대상으로 포함됩니다.",
    weightedTitle: "Weighted Scoring",
    weightedDesc: "더 길고 복잡한 세션에 더 많은 가중치를 부여합니다.",
    consistencyTitle: "Consistency Score (0~10)",
    consistencyDesc: "최근 20개 세션의 overall score 표준편차를 기반으로 일관성을 측정합니다.",
    compositeTitle: "Composite Rank Score",
    compositeDesc: "가중 점수(80%)와 일관성 점수(20%)를 결합한 최종 비교 순위 점수입니다.",
    dataSourceTitle: "Data Source",
  },
};

/* ── Threshold items ── */

export const THRESHOLD_ITEMS: Record<Lang, { value: string; label: string; code: string }[]> = {
  en: [
    { value: "5 min", label: "Min session duration", code: "session_duration_minutes" },
    { value: "10 calls", label: "Min tool call count", code: "total_tool_calls" },
    { value: "1 msg", label: "Min human message count", code: "total_human_messages" },
  ],
  ko: [
    { value: "5 min", label: "최소 세션 시간", code: "session_duration_minutes" },
    { value: "10 calls", label: "최소 tool call 수", code: "total_tool_calls" },
    { value: "1 msg", label: "최소 human message 수", code: "total_human_messages" },
  ],
};

/* ── Dimension configs by language ── */

const DIMENSIONS_EN: DimensionConfig[] = [
  {
    title: "MORE (P-threads) — Parallelism",
    subtitle: "Number of parallel execution paths",
    color: "cyan", accentHex: "#00FF88", maxScore: "5+",
    formulaTitle: "Score Formula",
    formula: [{ code: "p_thread_score = max(max_concurrent_agents, peak_parallel_tools)", comment: "max of concurrent agents and parallel tool calls, capped at 10" }],
    fullScoreNote: "10/10: 10+ sub-agents running concurrently, OR 10+ parallel tool calls in a single message. Direct value — no log scale.",
    detailTitle: "Sweep-Line Algorithm",
    detail: [
      "Score = the larger of (concurrent agents) and (parallel tools in one message).",
      "This is a direct value, NOT log-scaled. Score equals the raw count, capped at 10.",
      "",
      "How max_concurrent_agents is computed:",
      "1. Extract [first_seen, last_seen] time range for each sub-agent",
      "2. Create +1 event at start, -1 event at end",
      "3. Sort by time and sweep to find max overlap = max_concurrent_agents",
      "",
      "How peak_parallel_tools is computed:",
      "4. Count tool_use blocks in a single assistant message = peak_parallel_tools",
      "   e.g. Claude calls Read, Grep, Glob simultaneously → peak = 3",
    ],
    examples: [
      {
        title: "Simple Q&A (score: 0)",
        lines: [
          "User asks a question, Claude answers with Read + Grep (sequential).",
          "max_concurrent_agents = 0, peak_parallel_tools = 1",
        ],
        result: "p_thread_score = max(0, 1) = 1",
      },
      {
        title: "Parallel file reads (score: 3)",
        lines: [
          "Claude reads 3 files simultaneously in one message: Read, Read, Read.",
          "max_concurrent_agents = 0, peak_parallel_tools = 3",
        ],
        result: "p_thread_score = max(0, 3) = 3",
      },
      {
        title: "Team-based refactoring (score: 5)",
        lines: [
          "Claude spawns 5 Agent sub-agents for parallel work.",
          "Sweep-line detects 5 agents active at the same time.",
          "max_concurrent_agents = 5, peak_parallel_tools = 2",
        ],
        result: "p_thread_score = max(5, 2) = 5",
      },
    ],
    metrics: [
      { name: "max_concurrent_agents", desc: "Maximum sub-agents active simultaneously. Computed via sweep-line algorithm over agent_progress event time ranges." },
      { name: "total_sub_agents", desc: "Total unique sub-agents created during the session." },
      { name: "peak_parallel_tools", desc: "Maximum number of tool_use blocks called simultaneously in a single assistant message." },
    ],
    scoring: [
      { range: "0", meaning: "No sub-agents, sequential execution" },
      { range: "1", meaning: "Sub-agents present but not concurrent" },
      { range: "2~3", meaning: "Moderate parallelism" },
      { range: "4~5+", meaning: "High parallelism (P-thread)" },
    ],
    tips: [
      "Use Agent tool to execute independent tasks simultaneously.",
      "Request parallel tool calls for independent operations like code search and file reads.",
      '"Analyze these 3 files simultaneously" → Claude spawns 3 Agents.',
      "Request concurrent test, build, and lint runs.",
      "For complex refactoring, separate modules into sub-agents for P-thread classification.",
    ],
  },
  {
    title: "LONGER (L-threads) — Autonomy",
    subtitle: "Autonomous execution time without human intervention",
    color: "green", accentHex: "#FFD600", maxScore: "10",
    formulaTitle: "Score Formula",
    formula: [
      { code: "l_thread_score = min(log1p(longest_stretch_minutes) * 2.0, 10)", comment: "log1p(x) = ln(1+x)" },
    ],
    fullScoreNote: "10/10: ~148 minutes (≈2h 28m) of continuous autonomous work. Derived from ln(1+148) × 2 ≈ 10.0",
    detailTitle: "Activity-Based Measurement",
    detail: [
      "Uses log scale: log1p(x) = ln(1+x). This compresses large values so diminishing returns apply.",
      "Why log1p instead of ln? → ln(0) = -∞ (crashes), but ln(1+0) = 0 (safe for zero input).",
      "",
      "Key: Measures from human message to Claude's last activity (tool call).",
      "Measures only Claude's actual working time, not until the next human message.",
      "",
      "Example: Human(10:00) → Claude works → last tool(10:05) → [idle] → Human(12:00)",
      "   Without activity-based measurement: incorrectly 120 min. OMAS: correctly 5 min.",
      "",
      "Segments: (1) before first human, (2) between humans, (3) after last human — max of each.",
    ],
    referenceTable: {
      title: "Score Reference Table",
      rows: [
        { input: "0 min", score: "0.0" }, { input: "1 min", score: "1.4" },
        { input: "5 min", score: "3.6" }, { input: "10 min", score: "4.8" },
        { input: "20 min", score: "6.1" }, { input: "30 min", score: "6.9" },
        { input: "60 min", score: "8.2" }, { input: "120 min", score: "9.6" },
        { input: "148 min", score: "10.0" },
      ],
    },
    examples: [
      {
        title: "Quick Q&A (score: 0)",
        lines: [
          "User asks, Claude responds immediately. No tool calls between messages.",
          "longest_autonomous_stretch = 0 min",
        ],
        result: "l_thread_score = min(log1p(0) * 2.0, 10) = 0.0",
      },
      {
        title: "5-minute autonomous work (score: 3.6)",
        lines: [
          'User: "Fix the login bug"',
          "Claude works for 5 minutes: Grep → Read → Edit → Bash(test) → done.",
          "longest_autonomous_stretch = 5 min",
        ],
        result: "l_thread_score = min(log1p(5) * 2.0, 10) = min(3.58, 10) = 3.58",
      },
      {
        title: "30-minute feature implementation (score: 6.9)",
        lines: [
          'User: "Implement the entire auth module with tests and docs"',
          "Claude works for 30 min straight: 47 tool calls, no human intervention.",
          "longest_autonomous_stretch = 30 min",
        ],
        result: "l_thread_score = min(log1p(30) * 2.0, 10) = min(6.88, 10) = 6.88",
      },
    ],
    metrics: [
      { name: "longest_autonomous_stretch_minutes", desc: "Max time (minutes) between human message and Claude's last activity. Activity-based measurement excludes idle time." },
      { name: "max_tool_calls_between_human", desc: "Maximum number of tool calls between human messages." },
      { name: "session_duration_minutes", desc: "Total session length (first to last timestamp)." },
      { name: "max_consecutive_assistant_turns", desc: "Maximum consecutive assistant messages." },
    ],
    scoring: [
      { range: "0~2", meaning: "Short conversation, frequent intervention (<1 min)" },
      { range: "2~5", meaning: "Moderate autonomy (1~10 min autonomous)" },
      { range: "5~7", meaning: "High autonomy (10~30 min autonomous)" },
      { range: "7~10", meaning: "Very high autonomy (30+ min L-thread)" },
    ],
    tips: [
      "Give clear and specific instructions at once so Claude runs autonomously longer.",
      "Don't break large tasks into small pieces — deliver all requirements at once.",
      '"Refactor this entire module. Write tests and create a PR too."',
      "Trust Claude to make its own decisions without interrupting mid-work.",
      "Write detailed project conventions in CLAUDE.md so Claude works longer without questions.",
    ],
  },
  {
    title: "THICKER (B-threads) — Density",
    subtitle: "Sub-agent scale and nesting depth",
    color: "red", accentHex: "#FF6B35", maxScore: "10+",
    formulaTitle: "Score Formula",
    formula: [{ code: "b_thread_score = total_sub_agents * max(1, max_sub_agent_depth)", comment: "sub-agent count × nesting depth, capped at 10" }],
    fullScoreNote: "10/10: e.g. 5 sub-agents × depth 2 = 10, or 10 flat sub-agents × depth 1 = 10. Multiplicative — depth is the multiplier.",
    detailTitle: "Sub-Agent Depth Detection",
    detail: [
      "Direct multiplication — NOT log-scaled. Raw product is capped at 10.",
      "Depth acts as a multiplier, rewarding nested agent architectures.",
      "",
      "depth=0: No sub-agents → score always 0",
      "depth=1: Flat sub-agents (don't spawn their own agents)",
      "depth=2+: Nested — sub-agents spawn sub-agents (B-thread classification)",
      "",
      "Detection: If a subagent's JSONL file contains agent_progress events, it's nested.",
      "Examples: 3 agents × depth 2 = 6 | 5 agents × depth 2 = 10 | 10 agents × depth 1 = 10",
    ],
    examples: [
      {
        title: "No sub-agents (score: 0)",
        lines: [
          "Simple session with direct tool calls only.",
          "total_sub_agents = 0, max_sub_agent_depth = 0",
        ],
        result: "b_thread_score = 0 * max(1, 0) = 0",
      },
      {
        title: "3 flat sub-agents (score: 3)",
        lines: [
          "Claude spawns 3 Explore agents for research (none spawn sub-agents).",
          "total_sub_agents = 3, max_sub_agent_depth = 1",
        ],
        result: "b_thread_score = 3 * max(1, 1) = 3",
      },
      {
        title: "4 nested sub-agents (score: 8)",
        lines: [
          "Claude spawns a team of 4 agents. One agent spawns its own sub-agent.",
          "total_sub_agents = 4, max_sub_agent_depth = 2 (nested)",
        ],
        result: "b_thread_score = 4 * max(1, 2) = 8 (B-thread!)",
      },
    ],
    metrics: [
      { name: "tool_calls_per_minute", desc: "Tool calls per minute. total_tool_calls / max(duration_minutes, 0.1)" },
      { name: "max_sub_agent_depth", desc: "Maximum sub-agent nesting depth. 0=none, 1=flat, 2+=nested (B-thread)." },
      { name: "total_tool_calls", desc: "Total tool calls performed across the entire session." },
      { name: "tokens_per_minute", desc: "Tokens consumed per minute. (input_tokens + output_tokens) / duration." },
    ],
    scoring: [
      { range: "0", meaning: "No sub-agents" },
      { range: "1~3", meaning: "Basic sub-agent usage" },
      { range: "4~6", meaning: "Active sub-agent usage" },
      { range: "7+", meaning: "Nested sub-agents (B-thread, high density)" },
    ],
    tips: [
      "Use Team/Agent features for complex tasks with nested sub-agents.",
      'Request "organize a team for this" on large projects for B-thread classification.',
      "Encourage deep execution trees where sub-agents spawn sub-agents.",
      "Separate code analysis → implementation → testing → review into individual sub-agents.",
      "Combine with worktree isolation for even higher density.",
    ],
  },
  {
    title: "FEWER (Trust) — Reduced Human Checkpoints",
    subtitle: "Human checkpoint reduction, trust level",
    color: "yellow", accentHex: "#A855F7", maxScore: "10",
    formulaTitle: "Score Formula",
    formula: [
      { code: "effective_human = human_messages - trivial_delegations", comment: "excludes trivial delegations (≤5 tool calls after human msg)" },
      { code: "ratio_score = min(log1p(tool_calls / effective_human) * 2.0, 10)", comment: "log1p(x) = ln(1+x), log-scaled ratio" },
      { code: "ask_penalty = min(penalized_ask_ratio * 10.0, 3.0)", comment: "only AskUserQuestion OUTSIDE plan mode (max -3 pts)" },
      { code: "z_thread_score = max(ratio_score - ask_penalty, 0.0)", comment: "final = ratio score - penalty (floor 0)" },
    ],
    fullScoreNote: "10/10: ~148+ tool calls per effective human message with no AskUser penalty. Trivial delegations like 'run tests' (≤5 tool calls) are excluded from human count.",
    detailTitle: "Trivial Delegation Filter & Penalty System",
    detail: [
      "Three-part formula: filter trivial delegations → base ratio (log scale) → minus penalty.",
      "Uses log1p(x) = ln(1+x) for the ratio — same diminishing returns as L-thread.",
      "",
      "Step 1: Trivial Delegation Filter (NEW)",
      "   If a human message is followed by ≤ 5 tool calls before the next human message,",
      "   it is classified as a 'trivial delegation' (e.g. 'run tests', 'build it').",
      "   These are NOT genuine checkpoints — they're simple convenience requests.",
      "   effective_human_count = human_messages - trivial_delegations (min 1).",
      "",
      "   Example: 3 human messages → tool counts per segment: [2, 40, 3]",
      "   → Segments with ≤ 5 tools: 2 (trivial). Segment with 40: real work.",
      "   → effective_human = 3 - 2 = 1. Only the 40-tool segment counts.",
      "",
      "Step 2: Penalty targets ONLY AskUserQuestion outside Plan Mode:",
      "   penalized_ask_ratio = penalized_ask_count / total_tool_calls",
      "   ask_penalty = min(penalized_ask_ratio × 10, 3.0) → maximum -3 points",
      "",
      "AskUserQuestion is classified into two contexts:",
      "1. Inside Plan Mode (EnterPlanMode ~ ExitPlanMode):",
      "   → No penalty! Clarifying requirements during planning is good practice.",
      "",
      "2. Outside Plan Mode (during implementation):",
      "   → Penalty applied. Asking users mid-implementation signals uncertainty.",
      "",
      "Example: Plan Mode 3 questions + implementation 1 question",
      "   → plan_mode_ask_user_count = 3 (no penalty)",
      "   → penalized_ask_user_count = 1 (only this penalized)",
    ],
    referenceTable: {
      title: "Score Reference Table (ratio_score before penalty)",
      rows: [
        { input: "1 tool/human", score: "1.4" }, { input: "5 tools/human", score: "3.6" },
        { input: "10 tools/human", score: "4.8" }, { input: "20 tools/human", score: "6.1" },
        { input: "50 tools/human", score: "7.9" }, { input: "100 tools/human", score: "9.2" },
        { input: "148 tools/human", score: "10.0" },
      ],
    },
    examples: [
      {
        title: "Frequent back-and-forth (score: 1.4)",
        lines: [
          "10 tool calls, 10 human messages (user asks after every step).",
          "ratio = 10 / 10 = 1.0, no AskUser penalty.",
        ],
        result: "z_thread_score = min(log1p(1.0) * 2.0, 10) - 0 = 1.39",
      },
      {
        title: "Autonomous implementation (score: 6.1)",
        lines: [
          'User: "Build the entire API module"',
          "Claude makes 40 tool calls with only 2 human messages.",
          "ratio = 40 / 2 = 20.0, no AskUser outside plan mode.",
        ],
        result: "z_thread_score = min(log1p(20) * 2.0, 10) = min(6.09, 10) = 6.09",
      },
      {
        title: "With AskUser penalty (score: 4.2)",
        lines: [
          "50 tool calls, 2 human messages. But 3 AskUserQuestion outside plan mode.",
          "ratio = 50 / 2 = 25.0 → ratio_score = min(log1p(25) * 2.0, 10) = 6.52",
          "penalty: penalized_ask_ratio = 3/50 = 0.06 → ask_penalty = min(0.6, 3.0) = 0.6",
        ],
        result: "z_thread_score = max(6.52 - 0.6, 0) = 5.92",
      },
      {
        title: "Plan Mode exception (no penalty)",
        lines: [
          "Claude enters Plan Mode, asks 3 clarifying questions, exits, then executes.",
          "100 tool calls, 1 human message. 3 AskUser in plan mode + 0 outside.",
          "ratio = 100 / 1 = 100 → ratio_score = 9.23, penalty = 0",
        ],
        result: "z_thread_score = 9.23 (plan mode questions NOT penalized!)",
      },
      {
        title: "Trivial delegation filter (score boost)",
        lines: [
          "3 human messages, but 2 are trivial ('run tests' → 1 tool, 'build' → 2 tools).",
          "Only 1 message triggered real work (40 tool calls). Total = 43 tools.",
          "Without filter: ratio = 43/3 = 14.3 → score = 5.47",
          "With filter: effective_human = 3 - 2 = 1, ratio = 43/1 = 43 → score = 7.56",
        ],
        result: "z_thread_score = 7.56 (trivial delegations excluded from human count!)",
      },
    ],
    metrics: [
      { name: "tool_calls_per_human_message", desc: "Tool calls per effective human message. total_tool_calls / max(effective_human_count, 1). Excludes trivial delegations." },
      { name: "assistant_per_human_ratio", desc: "Assistant to human message ratio. assistant_count / max(human_count, 1)" },
      { name: "ask_user_count", desc: "Total AskUserQuestion invocations (including plan mode)." },
      { name: "plan_mode_ask_user_count", desc: "AskUserQuestion count inside Plan Mode (between EnterPlanMode ~ ExitPlanMode). No penalty." },
      { name: "penalized_ask_user_count", desc: "AskUserQuestion count outside Plan Mode. Only these are penalized." },
      { name: "autonomous_tool_call_pct", desc: "Percentage of tool calls excluding penalized AskUser. (1 - penalized/total) * 100" },
      { name: "trivial_delegation_count", desc: "Human messages classified as trivial delegation (≤5 tool calls in following segment). Excluded from trust ratio." },
      { name: "effective_human_count", desc: "Human messages actually used in trust ratio. = human_messages - trivial_delegations (min 1)." },
    ],
    scoring: [
      { range: "0~2", meaning: "Low trust (frequent intervention, few tool calls/human)" },
      { range: "2~5", meaning: "Moderate level (~5-10 tool calls per human)" },
      { range: "5~8", meaning: "High trust (~20-50 tool calls per human)" },
      { range: "8~10", meaning: "Very high trust (Z-thread level, 100+ tools/human)" },
    ],
    tips: [
      "Give clear instructions once so Claude handles everything autonomously.",
      "Write coding conventions, preferred patterns, and project structure in CLAUDE.md.",
      "Asking questions in Plan Mode is fine — no penalty!",
      "To reduce implementation questions, clarify requirements during the planning phase.",
      "Pre-approve permissions (auto-accept) so execution continues without interruption.",
      "Aim for Z-thread: automate entire feature implementation with a single command.",
    ],
  },
];

const DIMENSIONS_KO: DimensionConfig[] = [
  {
    title: "MORE (P-threads) — Parallelism",
    subtitle: "병렬 실행 경로 수",
    color: "cyan", accentHex: "#00FF88", maxScore: "5+",
    formulaTitle: "Score Formula",
    formula: [{ code: "p_thread_score = max(max_concurrent_agents, peak_parallel_tools)", comment: "동시 에이전트 수와 병렬 tool call 수 중 큰 값, cap 10" }],
    fullScoreNote: "만점(10): 동시 실행 에이전트 10개 이상, 또는 단일 메시지에서 tool 10개 이상 병렬 호출. 직접 값 — log 스케일 아님.",
    detailTitle: "Sweep-Line Algorithm (동시 에이전트 계산)",
    detail: [
      "점수 = (동시 에이전트 수)와 (한 메시지 내 병렬 tool 수) 중 큰 값.",
      "직접 값이며 log 스케일이 아닙니다. 원시 수치 그대로, cap 10.",
      "",
      "max_concurrent_agents 계산 방법:",
      "1. 각 서브에이전트의 [first_seen, last_seen] 시간 범위를 추출",
      "2. 시작점에 +1, 종료점에 -1 이벤트 생성",
      "3. 시간순으로 정렬 후 sweep하여 최대 중첩 수 = max_concurrent_agents",
      "",
      "peak_parallel_tools 계산 방법:",
      "4. 단일 assistant 메시지 내 tool_use 블록 수 = peak_parallel_tools",
      "   예: Claude가 Read, Grep, Glob을 동시에 호출 → peak = 3",
    ],
    examples: [
      {
        title: "단순 Q&A (점수: 0)",
        lines: [
          "사용자가 질문하고, Claude가 Read + Grep으로 순차 응답.",
          "max_concurrent_agents = 0, peak_parallel_tools = 1",
        ],
        result: "p_thread_score = max(0, 1) = 1",
      },
      {
        title: "병렬 파일 읽기 (점수: 3)",
        lines: [
          "Claude가 하나의 메시지에서 3개 파일을 동시에 읽음: Read, Read, Read.",
          "max_concurrent_agents = 0, peak_parallel_tools = 3",
        ],
        result: "p_thread_score = max(0, 3) = 3",
      },
      {
        title: "팀 기반 리팩토링 (점수: 5)",
        lines: [
          "Claude가 5개 Agent 서브에이전트를 병렬로 실행.",
          "Sweep-line 알고리즘으로 5개 에이전트가 동시 활성 감지.",
          "max_concurrent_agents = 5, peak_parallel_tools = 2",
        ],
        result: "p_thread_score = max(5, 2) = 5",
      },
    ],
    metrics: [
      { name: "max_concurrent_agents", desc: "동시에 활성화된 최대 서브에이전트 수. sweep-line 알고리즘으로 agent_progress 이벤트의 시간 범위 중첩을 계산합니다." },
      { name: "total_sub_agents", desc: "세션에서 생성된 고유 서브에이전트 총 수." },
      { name: "peak_parallel_tools", desc: "단일 assistant 메시지 내에서 동시 호출된 tool_use의 최대 개수." },
    ],
    scoring: [
      { range: "0", meaning: "서브에이전트 없음, 순차 실행" },
      { range: "1", meaning: "서브에이전트 있지만 동시 실행 아님" },
      { range: "2~3", meaning: "적절한 병렬 처리" },
      { range: "4~5+", meaning: "높은 병렬성 (P-thread)" },
    ],
    tips: [
      "Agent tool을 사용해 독립적인 작업을 동시에 실행하세요.",
      "코드 검색, 파일 읽기 등 의존성 없는 작업은 parallel tool call로 요청하세요.",
      '"이 3개 파일을 동시에 분석해줘" → Claude가 3개 Agent를 spawn.',
      "연관 없는 테스트, 빌드, 린트를 동시에 돌리도록 요청하세요.",
      "복잡한 리팩토링 시 각 모듈별로 서브에이전트를 분리하면 P-thread가 됩니다.",
    ],
  },
  {
    title: "LONGER (L-threads) — Autonomy",
    subtitle: "인간 개입 없이 자율 실행 시간",
    color: "green", accentHex: "#FFD600", maxScore: "10",
    formulaTitle: "Score Formula",
    formula: [
      { code: "l_thread_score = min(log1p(longest_stretch_minutes) * 2.0, 10)", comment: "log1p(x) = ln(1+x)" },
    ],
    fullScoreNote: "만점(10): 약 148분(≈2시간 28분) 연속 자율 작업. ln(1+148) × 2 ≈ 10.0",
    detailTitle: "Activity-Based Measurement (활동 기반 자율 시간 측정)",
    detail: [
      "log 스케일 사용: log1p(x) = ln(1+x). 큰 값일수록 체감 증가폭이 줄어듭니다.",
      "왜 ln(x) 대신 ln(1+x)? → ln(0) = -∞ (에러), ln(1+0) = 0 (안전).",
      "",
      "핵심: human message → Claude의 마지막 activity(tool call)까지를 측정.",
      "다음 human message까지가 아닌, Claude가 실제로 일한 시간만 측정합니다.",
      "",
      "예: Human(10:00) → Claude 작업 → 마지막 tool(10:05) → [유휴] → Human(12:00)",
      "   활동 기반 측정 없이는 120분으로 잘못 측정. OMAS는 실제 5분만 정확히 측정.",
      "",
      "구간: (1) 첫 human 전, (2) human 간, (3) 마지막 human 후 — 각각 계산 후 max.",
    ],
    referenceTable: {
      title: "Score Reference Table",
      rows: [
        { input: "0분", score: "0.0" }, { input: "1분", score: "1.4" },
        { input: "5분", score: "3.6" }, { input: "10분", score: "4.8" },
        { input: "20분", score: "6.1" }, { input: "30분", score: "6.9" },
        { input: "60분", score: "8.2" }, { input: "120분", score: "9.6" },
        { input: "148분", score: "10.0" },
      ],
    },
    examples: [
      {
        title: "짧은 Q&A (점수: 0)",
        lines: [
          "사용자가 질문, Claude가 즉시 응답. 메시지 사이 tool call 없음.",
          "longest_autonomous_stretch = 0분",
        ],
        result: "l_thread_score = min(log1p(0) * 2.0, 10) = 0.0",
      },
      {
        title: "5분 자율 작업 (점수: 3.6)",
        lines: [
          '사용자: "로그인 버그 고쳐줘"',
          "Claude가 5분간 작업: Grep → Read → Edit → Bash(test) → 완료.",
          "longest_autonomous_stretch = 5분",
        ],
        result: "l_thread_score = min(log1p(5) * 2.0, 10) = 3.58",
      },
      {
        title: "30분 기능 구현 (점수: 6.9)",
        lines: [
          '사용자: "인증 모듈 전체를 테스트와 문서까지 구현해줘"',
          "Claude가 30분간 쉬지 않고 작업: 47개 tool call, 인간 개입 없음.",
          "longest_autonomous_stretch = 30분",
        ],
        result: "l_thread_score = min(log1p(30) * 2.0, 10) = 6.88",
      },
    ],
    metrics: [
      { name: "longest_autonomous_stretch_minutes", desc: "human message → Claude의 마지막 activity 사이 최대 시간(분). Activity-based 측정으로 유휴 시간을 제외합니다." },
      { name: "max_tool_calls_between_human", desc: "human 메시지 사이에 수행된 tool call 수의 최대값." },
      { name: "session_duration_minutes", desc: "세션 전체 길이 (첫 ~ 마지막 타임스탬프)." },
      { name: "max_consecutive_assistant_turns", desc: "연속 assistant 메시지 수의 최대값." },
    ],
    scoring: [
      { range: "0~2", meaning: "짧은 대화, 빈번한 개입 (<1분)" },
      { range: "2~5", meaning: "중간 자율성 (1~10분 자율 실행)" },
      { range: "5~7", meaning: "높은 자율성 (10~30분 자율 실행)" },
      { range: "7~10", meaning: "매우 높은 자율성 (30분+ L-thread)" },
    ],
    tips: [
      "명확하고 구체적인 지시를 한 번에 주면 Claude가 더 오래 자율 실행합니다.",
      "큰 작업을 잘게 쪼개지 말고, 전체 요구사항을 한 번에 전달하세요.",
      '"이 모듈 전체를 리팩토링해줘. 테스트도 작성하고, PR까지 만들어줘."',
      "중간에 끊지 않고 Claude가 스스로 판단하도록 신뢰를 주세요.",
      "CLAUDE.md에 프로젝트 컨벤션을 상세히 기술하면 질문 없이 더 오래 일합니다.",
    ],
  },
  {
    title: "THICKER (B-threads) — Density",
    subtitle: "서브에이전트 규모와 중첩 깊이",
    color: "red", accentHex: "#FF6B35", maxScore: "10+",
    formulaTitle: "Score Formula",
    formula: [{ code: "b_thread_score = total_sub_agents * max(1, max_sub_agent_depth)", comment: "서브에이전트 수 × 중첩 깊이, cap 10" }],
    fullScoreNote: "만점(10): 예) 5개 에이전트 × depth 2 = 10, 또는 10개 평면 에이전트 × depth 1 = 10. 곱셈 — depth가 승수 역할.",
    detailTitle: "Sub-Agent Depth Detection (중첩 깊이 감지)",
    detail: [
      "직접 곱셈 — log 스케일 아님. 원시 곱이 cap 10.",
      "Depth가 승수 역할을 하여, 중첩 에이전트 구조에 높은 보상을 줍니다.",
      "",
      "depth=0: 서브에이전트 없음 → 점수 항상 0",
      "depth=1: 평면 서브에이전트 (자체 에이전트를 생성하지 않음)",
      "depth=2+: 중첩 — 서브에이전트가 다시 서브에이전트를 생성 (B-thread 분류)",
      "",
      "감지 방법: subagent JSONL 파일 내에 agent_progress 이벤트가 있으면 중첩.",
      "예: 3 × depth 2 = 6 | 5 × depth 2 = 10 | 10 × depth 1 = 10",
    ],
    metrics: [
      { name: "tool_calls_per_minute", desc: "분당 tool call 수. total_tool_calls / max(duration_minutes, 0.1)" },
      { name: "max_sub_agent_depth", desc: "서브에이전트의 최대 중첩 깊이. 0=없음, 1=평면, 2+=중첩(B-thread)." },
      { name: "total_tool_calls", desc: "세션 전체에서 수행된 tool call 총 수." },
      { name: "tokens_per_minute", desc: "분당 소비된 토큰 수. (input_tokens + output_tokens) / duration." },
    ],
    scoring: [
      { range: "0", meaning: "서브에이전트 없음" },
      { range: "1~3", meaning: "기본적인 서브에이전트 활용" },
      { range: "4~6", meaning: "적극적인 서브에이전트 활용" },
      { range: "7+", meaning: "중첩 서브에이전트 (B-thread, 높은 밀도)" },
    ],
    examples: [
      {
        title: "서브에이전트 없음 (점수: 0)",
        lines: [
          "직접 tool call만 사용하는 단순 세션.",
          "total_sub_agents = 0, max_sub_agent_depth = 0",
        ],
        result: "b_thread_score = 0 * max(1, 0) = 0",
      },
      {
        title: "평면 서브에이전트 3개 (점수: 3)",
        lines: [
          "Claude가 리서치용 Explore 에이전트 3개를 실행 (자체 서브에이전트 생성 없음).",
          "total_sub_agents = 3, max_sub_agent_depth = 1",
        ],
        result: "b_thread_score = 3 * max(1, 1) = 3",
      },
      {
        title: "중첩 서브에이전트 4개 (점수: 8)",
        lines: [
          "Claude가 4개 에이전트 팀을 구성. 한 에이전트가 자체 서브에이전트를 생성.",
          "total_sub_agents = 4, max_sub_agent_depth = 2 (중첩)",
        ],
        result: "b_thread_score = 4 * max(1, 2) = 8 (B-thread!)",
      },
    ],
    tips: [
      "복잡한 작업에 Team/Agent 기능을 활용하여 서브에이전트를 중첩으로 사용하세요.",
      "큰 프로젝트에서 '팀을 구성해서 작업해줘'라고 요청하면 B-thread가 됩니다.",
      "서브에이전트가 다시 서브에이전트를 생성하는 깊은 실행 트리를 유도하세요.",
      "코드 분석 → 구현 → 테스트 → 리뷰를 각각 서브에이전트로 분리하세요.",
      "Worktree isolation과 병행하면 밀도가 더 높아집니다.",
    ],
  },
  {
    title: "FEWER (Trust) — Reduced Human Checkpoints",
    subtitle: "인간 체크포인트 감소, 신뢰도",
    color: "yellow", accentHex: "#A855F7", maxScore: "10",
    formulaTitle: "Score Formula",
    formula: [
      { code: "effective_human = human_messages - trivial_delegations", comment: "사소한 위임(≤5 tool calls) 제외" },
      { code: "ratio_score = min(log1p(tool_calls / effective_human) * 2.0, 10)", comment: "log1p(x) = ln(1+x), log 스케일 비율" },
      { code: "ask_penalty = min(penalized_ask_ratio * 10.0, 3.0)", comment: "Plan Mode 밖 AskUserQuestion만 패널티 (최대 -3점)" },
      { code: "z_thread_score = max(ratio_score - ask_penalty, 0.0)", comment: "최종 = ratio 점수 - 패널티 (최소 0)" },
    ],
    fullScoreNote: "만점(10): effective human 메시지당 ~148+ tool call + AskUser 패널티 없음. '테스트 돌려줘' 같은 사소한 위임(≤5 tool calls)은 human count에서 제외됩니다.",
    detailTitle: "Trivial Delegation 필터 & 패널티 시스템",
    detail: [
      "3단계 공식: 사소한 위임 필터링 → 기본 비율(log 스케일) → 패널티 차감.",
      "log1p(x) = ln(1+x) — L-thread와 동일한 체감 스케일 적용.",
      "",
      "Step 1: Trivial Delegation 필터 (신규)",
      "   human 메시지 이후 다음 human 메시지까지 tool call이 ≤ 5개이면,",
      "   해당 메시지는 '사소한 위임'으로 분류 (예: '테스트 돌려줘', '빌드해봐').",
      "   이것들은 진짜 체크포인트가 아닌 편의상 시킨 것입니다.",
      "   effective_human_count = human_messages - trivial_delegations (최소 1).",
      "",
      "   예: human 메시지 3개 → 구간별 tool 수: [2, 40, 3]",
      "   → tool ≤ 5인 구간: 2개(사소한 위임). 40 tool 구간: 실제 작업.",
      "   → effective_human = 3 - 2 = 1. 40-tool 구간만 카운트됩니다.",
      "",
      "Step 2: 패널티 대상은 Plan Mode 밖 AskUserQuestion만:",
      "   penalized_ask_ratio = penalized_ask_count / total_tool_calls",
      "   ask_penalty = min(penalized_ask_ratio × 10, 3.0) → 최대 -3점",
      "",
      "AskUserQuestion은 두 가지 맥락으로 분류됩니다:",
      "1. Plan Mode 내 (EnterPlanMode ~ ExitPlanMode 사이):",
      "   → 패널티 없음! 계획 단계에서 요구사항을 명확히 하는 것은 좋은 practice.",
      "",
      "2. Plan Mode 밖 (일반 구현 중):",
      "   → 패널티 적용. 구현 중 질문 = 불확실성을 의미.",
      "",
      "예: Plan Mode 3번 질문 + 구현 중 1번 질문",
      "   → plan_mode_ask_user_count = 3 (패널티 없음)",
      "   → penalized_ask_user_count = 1 (이것만 패널티)",
    ],
    referenceTable: {
      title: "Score Reference Table (패널티 전 ratio_score)",
      rows: [
        { input: "1 tool/human", score: "1.4" }, { input: "5 tools/human", score: "3.6" },
        { input: "10 tools/human", score: "4.8" }, { input: "20 tools/human", score: "6.1" },
        { input: "50 tools/human", score: "7.9" }, { input: "100 tools/human", score: "9.2" },
        { input: "148 tools/human", score: "10.0" },
      ],
    },
    metrics: [
      { name: "tool_calls_per_human_message", desc: "effective human 메시지 1개당 tool call 수. total_tool_calls / max(effective_human_count, 1). 사소한 위임은 제외." },
      { name: "assistant_per_human_ratio", desc: "human 메시지 대비 assistant 메시지 비율. assistant_count / max(human_count, 1)" },
      { name: "ask_user_count", desc: "AskUserQuestion 총 호출 횟수 (plan mode 포함)." },
      { name: "plan_mode_ask_user_count", desc: "Plan Mode 내 AskUserQuestion 횟수 (EnterPlanMode ~ ExitPlanMode 사이). 패널티 없음." },
      { name: "penalized_ask_user_count", desc: "Plan Mode 밖 AskUserQuestion 횟수. 이것만 패널티로 적용됩니다." },
      { name: "autonomous_tool_call_pct", desc: "전체 tool call 중 penalized AskUser를 제외한 비율(%). (1 - penalized/total) * 100" },
      { name: "trivial_delegation_count", desc: "사소한 위임으로 분류된 human 메시지 수 (이후 구간 tool call ≤ 5개). trust 비율에서 제외됩니다." },
      { name: "effective_human_count", desc: "trust 비율 계산에 실제 사용된 human 메시지 수. = human_messages - trivial_delegations (최소 1)." },
    ],
    scoring: [
      { range: "0~2", meaning: "낮은 신뢰 (빈번한 개입, 적은 tool call/인간)" },
      { range: "2~5", meaning: "보통 수준 (~5-10 tool calls per human)" },
      { range: "5~8", meaning: "높은 신뢰 (~20-50 tool calls per human)" },
      { range: "8~10", meaning: "매우 높은 신뢰 (Z-thread 수준, 100+ tools/human)" },
    ],
    examples: [
      {
        title: "빈번한 대화 (점수: 1.4)",
        lines: [
          "10개 tool call, 10개 human 메시지 (매 단계마다 사용자가 질문).",
          "ratio = 10 / 10 = 1.0, AskUser 패널티 없음.",
        ],
        result: "z_thread_score = min(log1p(1.0) * 2.0, 10) - 0 = 1.39",
      },
      {
        title: "자율 구현 (점수: 6.1)",
        lines: [
          '사용자: "API 모듈 전체를 구현해줘"',
          "Claude가 40개 tool call을 실행, human 메시지는 2개뿐.",
          "ratio = 40 / 2 = 20.0, plan mode 밖 AskUser 없음.",
        ],
        result: "z_thread_score = min(log1p(20) * 2.0, 10) = 6.09",
      },
      {
        title: "AskUser 패널티 적용 (점수: 5.9)",
        lines: [
          "50개 tool call, 2개 human 메시지. 그러나 plan mode 밖에서 AskUserQuestion 3회.",
          "ratio = 50 / 2 = 25.0 → ratio_score = min(log1p(25) * 2.0, 10) = 6.52",
          "penalty: penalized_ask_ratio = 3/50 = 0.06 → ask_penalty = min(0.6, 3.0) = 0.6",
        ],
        result: "z_thread_score = max(6.52 - 0.6, 0) = 5.92",
      },
      {
        title: "Plan Mode 예외 (패널티 없음)",
        lines: [
          "Claude가 Plan Mode에 진입, 3번 명확화 질문 후 나와서 구현 실행.",
          "100개 tool call, 1개 human 메시지. Plan Mode 안에서 AskUser 3회 + 밖에서 0회.",
          "ratio = 100 / 1 = 100 → ratio_score = 9.23, penalty = 0",
        ],
        result: "z_thread_score = 9.23 (Plan Mode 질문은 패널티 없음!)",
      },
      {
        title: "Trivial delegation 필터 (점수 상승)",
        lines: [
          "human 메시지 3개, 그 중 2개는 사소한 위임 ('테스트 돌려줘' → 1 tool, '빌드해봐' → 2 tools).",
          "실제 작업은 1개 메시지만 (40 tool calls). 총 tool = 43개.",
          "필터 없이: ratio = 43/3 = 14.3 → score = 5.47",
          "필터 적용: effective_human = 3 - 2 = 1, ratio = 43/1 = 43 → score = 7.56",
        ],
        result: "z_thread_score = 7.56 (사소한 위임은 human count에서 제외!)",
      },
    ],
    tips: [
      "한 번의 명확한 지시로 Claude가 스스로 모든 것을 처리하게 하세요.",
      "CLAUDE.md에 코딩 컨벤션, 선호하는 패턴, 프로젝트 구조를 상세히 기술하세요.",
      "Plan Mode에서 충분히 질문하는 것은 좋습니다 — 패널티가 없습니다!",
      "구현 중 질문을 줄이려면, 계획 단계에서 요구사항을 명확히 하세요.",
      "Permission을 미리 허용(auto-accept)하면 중단 없이 더 길게 실행됩니다.",
      "Z-thread를 목표로: 하나의 명령으로 전체 기능 구현까지 자동화하세요.",
    ],
  },
];

export const DIMENSIONS: Record<Lang, DimensionConfig[]> = { en: DIMENSIONS_EN, ko: DIMENSIONS_KO };

/* ── Thread types ── */

export const THREAD_TYPES: Record<Lang, ThreadTypeDef[]> = {
  en: [
    { type: "Z-thread", color: "#10B981", condition: "human_messages <= 1 AND tool_calls >= 10", desc: "Zero-touch: Minimal human input, maximum autonomous work. Most evolved form." },
    { type: "B-thread", color: "#EF4444", condition: "max_sub_agent_depth >= 2", desc: "Big: Sub-agents spawning sub-agents — nested execution." },
    { type: "L-thread", color: "#22C55E", condition: "autonomous_stretch > 30min AND tool_calls > 50", desc: "Long: 30+ minutes of autonomous execution without human intervention." },
    { type: "F-thread", color: "#A855F7", condition: "sub_agent_prompt_similarity > 70% (Jaccard)", desc: "Fusion: Similar tasks distributed to multiple agents (Map-Reduce pattern)." },
    { type: "P-thread", color: "#06B6D4", condition: "max_concurrent_agents > 1", desc: "Parallel: 2+ sub-agents running concurrently." },
    { type: "C-thread", color: "#EAB308", condition: "human_messages >= 3 AND each_gap_tool_calls >= 3", desc: "Chained: Human-AI conversation repeated in a chain pattern." },
    { type: "Base", color: "#6B7280", condition: "None of the above conditions met", desc: "Default conversational session. Short Q&A or simple tasks." },
  ],
  ko: [
    { type: "Z-thread", color: "#10B981", condition: "human_messages <= 1 AND tool_calls >= 10", desc: "Zero-touch: 최소 개입으로 대량의 자율 작업. 가장 진화된 형태." },
    { type: "B-thread", color: "#EF4444", condition: "max_sub_agent_depth >= 2", desc: "Big: 서브에이전트가 다시 서브에이전트를 생성하는 중첩 실행." },
    { type: "L-thread", color: "#22C55E", condition: "autonomous_stretch > 30min AND tool_calls > 50", desc: "Long: 인간 개입 없이 30분 이상 자율 실행." },
    { type: "F-thread", color: "#A855F7", condition: "sub_agent_prompt_similarity > 70% (Jaccard)", desc: "Fusion: 유사한 작업을 여러 서브에이전트에 분배 (Map-Reduce 패턴)." },
    { type: "P-thread", color: "#06B6D4", condition: "max_concurrent_agents > 1", desc: "Parallel: 2개 이상의 서브에이전트가 동시 실행." },
    { type: "C-thread", color: "#EAB308", condition: "human_messages >= 3 AND each_gap_tool_calls >= 3", desc: "Chained: 인간-AI 대화가 체인처럼 반복되며 진행." },
    { type: "Base", color: "#6B7280", condition: "위 조건 모두 해당 없음", desc: "기본 대화형 세션. 짧은 Q&A나 간단한 작업." },
  ],
};

/* ── Roadmap steps ── */

export const ROADMAP_STEPS: Record<Lang, RoadmapStepDef[]> = {
  en: [
    { from: "Base", to: "C-thread", tip: "Continue conversations for 3+ turns, progressively building work. Ensure 3+ tool calls per turn." },
    { from: "C-thread", to: "P-thread", tip: "Request 2+ independent tasks simultaneously. Explicitly say 'use Agent tool for parallel processing'." },
    { from: "P-thread", to: "L-thread", tip: "Describe requirements in detail and reduce mid-work intervention. A thorough CLAUDE.md enables 30+ min autonomous runs." },
    { from: "L-thread", to: "B-thread", tip: "Use 'organize a team' or 'work in a worktree' to encourage deep sub-agent trees." },
    { from: "B-thread", to: "Z-thread", tip: "Ultimate goal: implement an entire feature with a single command. Auto-approve permissions + detailed project docs + clear single instruction." },
  ],
  ko: [
    { from: "Base", to: "C-thread", tip: "대화를 3턴 이상 이어가며 점진적으로 작업을 발전시키세요. 각 턴에서 3개 이상의 tool call이 발생하도록 요청하세요." },
    { from: "C-thread", to: "P-thread", tip: "독립적인 작업 2개 이상을 동시에 요청하세요. 'Agent tool로 병렬 처리해줘'라고 명시하면 효과적입니다." },
    { from: "P-thread", to: "L-thread", tip: "요구사항을 상세히 기술하고 중간 개입을 줄이세요. CLAUDE.md를 충실히 작성하면 질문 없이 30분 이상 자율 실행합니다." },
    { from: "L-thread", to: "B-thread", tip: "'팀을 구성해서 작업해줘', 'worktree에서 작업해줘' 등으로 깊은 서브에이전트 트리를 유도하세요." },
    { from: "B-thread", to: "Z-thread", tip: "궁극의 목표: 하나의 명령으로 기능 전체를 구현. Permission 자동 승인 + 상세한 프로젝트 문서 + 명확한 단일 지시." },
  ],
};

/* ── Tailwind color maps ── */

export const BORDER_COLORS: Record<string, string> = {
  cyan: "border-cyan-500/30", green: "border-green-500/30",
  red: "border-red-500/30", yellow: "border-yellow-500/30",
};

export const TEXT_COLORS: Record<string, string> = {
  cyan: "text-cyan-400", green: "text-green-400",
  red: "text-red-400", yellow: "text-yellow-400",
};

export const BG_COLORS: Record<string, string> = {
  cyan: "bg-cyan-500/10", green: "bg-green-500/10",
  red: "bg-red-500/10", yellow: "bg-yellow-500/10",
};
