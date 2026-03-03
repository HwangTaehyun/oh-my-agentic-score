/** Static data for the Scoring Guide page (Pencil P8). */

export interface FormulaLine {
  code: string;
  comment: string | null;
}

export interface RefRow {
  input: string;
  score: string;
}

export interface MetricDef {
  name: string;
  desc: string;
}

export interface ScoreRange {
  range: string;
  meaning: string;
}

export interface DimensionConfig {
  title: string;
  subtitle: string;
  color: string;
  accentHex: string;
  maxScore: string;
  formulaTitle: string;
  formula: FormulaLine[];
  detailTitle: string;
  detail: string[];
  referenceTable?: { title: string; rows: RefRow[] };
  metrics: MetricDef[];
  scoring: ScoreRange[];
  tips: string[];
}

export interface ThreadTypeDef {
  type: string;
  color: string;
  condition: string;
  desc: string;
}

export interface RoadmapStepDef {
  from: string;
  to: string;
  tip: string;
}

/* ── Dimension configs ── */

export const DIMENSIONS: DimensionConfig[] = [
  {
    title: "MORE (P-threads) — Parallelism",
    subtitle: "병렬 실행 경로 수",
    color: "cyan",
    accentHex: "#00FF88",
    maxScore: "5+",
    formulaTitle: "Score Formula",
    formula: [
      { code: "p_thread_score = max(max_concurrent_agents, peak_parallel_tools)", comment: "동시 에이전트 수와 병렬 tool call 수 중 큰 값" },
    ],
    detailTitle: "Sweep-Line Algorithm (동시 에이전트 계산)",
    detail: [
      "1. 각 서브에이전트의 [first_seen, last_seen] 시간 범위를 추출",
      "2. 시작점에 +1, 종료점에 -1 이벤트 생성",
      "3. 시간순으로 정렬 후 sweep하여 최대 중첩 수 = max_concurrent_agents",
      "4. 단일 assistant 메시지 내 tool_use 블록 수 = peak_parallel_tools",
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
    color: "green",
    accentHex: "#FFD600",
    maxScore: "10",
    formulaTitle: "Score Formula",
    formula: [
      { code: "l_thread_score = min(log1p(longest_stretch_minutes) * 2.0, 10)", comment: null },
    ],
    detailTitle: "Activity-Based Measurement (활동 기반 자율 시간 측정)",
    detail: [
      "핵심: human message → Claude의 마지막 activity(tool call)까지를 측정",
      "다음 human message까지가 아닌, Claude가 실제로 일한 시간만 측정합니다.",
      "예: Human(10:00) → Claude 작업 → 마지막 tool(10:05) → [유휴] → Human(12:00)",
      "   기존 방식: 120분 (잘못됨) | OMAS 방식: 5분 (정확함)",
      "구간: (1) 첫 human 전, (2) human 간, (3) 마지막 human 후 — 각각 계산 후 max",
    ],
    referenceTable: {
      title: "Score Reference Table",
      rows: [
        { input: "0분", score: "0.0" },
        { input: "1분", score: "1.4" },
        { input: "5분", score: "3.6" },
        { input: "10분", score: "4.8" },
        { input: "20분", score: "6.1" },
        { input: "30분", score: "6.9" },
        { input: "60분", score: "8.2" },
        { input: "120분", score: "9.6" },
        { input: "200+분", score: "~10.0" },
      ],
    },
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
    color: "red",
    accentHex: "#FF6B35",
    maxScore: "10+",
    formulaTitle: "Score Formula",
    formula: [
      { code: "b_thread_score = total_sub_agents * max(1, max_sub_agent_depth)", comment: "서브에이전트 수 × 중첩 깊이" },
    ],
    detailTitle: "Sub-Agent Depth Detection (중첩 깊이 감지)",
    detail: [
      "depth=0: 서브에이전트 없음",
      "depth=1: 서브에이전트 있지만 자체적으로 에이전트를 생성하지 않음",
      "depth=2+: 서브에이전트가 다시 서브에이전트를 생성 (B-thread)",
      "감지 방법: subagent JSONL 파일 내에 agent_progress 이벤트가 있으면 중첩",
      "예: 3개 서브에이전트 × depth 2 = b_thread_score 6",
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
    color: "yellow",
    accentHex: "#A855F7",
    maxScore: "10",
    formulaTitle: "Score Formula",
    formula: [
      { code: "ratio_score = min(log1p(tool_calls / human_messages) * 2.0, 10)", comment: "primary: 인간 메시지당 tool call 비율 (log scale)" },
      { code: "ask_penalty = min(penalized_ask_ratio * 10.0, 3.0)", comment: "penalty: plan mode 밖의 AskUserQuestion만 패널티 (최대 -3점)" },
      { code: "z_thread_score = max(ratio_score - ask_penalty, 0.0)", comment: "최종 점수 = ratio 점수 - 패널티 (0 이상)" },
    ],
    detailTitle: "Plan Mode Exception (계획 모드 예외)",
    detail: [
      "AskUserQuestion은 두 가지 맥락으로 분류됩니다:",
      "",
      "1. Plan Mode 내 (EnterPlanMode ~ ExitPlanMode 사이):",
      "   → 패널티 없음! 계획 단계에서 요구사항을 명확히 하는 것은",
      "     오히려 좋은 practice입니다. 질문을 통해 더 나은 자율 실행이 가능해집니다.",
      "",
      "2. Plan Mode 밖 (일반 구현 중):",
      "   → 패널티 적용. 구현 중 사용자에게 질문하는 것은 불확실성을 의미합니다.",
      "",
      "예: Plan Mode에서 3번 질문 + 구현 중 1번 질문",
      "   → plan_mode_ask_user_count = 3 (패널티 없음)",
      "   → penalized_ask_user_count = 1 (이것만 패널티)",
    ],
    referenceTable: {
      title: "Score Reference Table",
      rows: [
        { input: "1 tool/human", score: "1.4" },
        { input: "5 tools/human", score: "3.6" },
        { input: "10 tools/human", score: "4.8" },
        { input: "20 tools/human", score: "6.1" },
        { input: "50 tools/human", score: "7.9" },
        { input: "100 tools/human", score: "9.2" },
        { input: "150+ tools/human", score: "~10.0" },
      ],
    },
    metrics: [
      { name: "tool_calls_per_human_message", desc: "human 메시지 1개당 tool call 수. total_tool_calls / max(human_count, 1)" },
      { name: "assistant_per_human_ratio", desc: "human 메시지 대비 assistant 메시지 비율. assistant_count / max(human_count, 1)" },
      { name: "ask_user_count", desc: "AskUserQuestion 총 호출 횟수 (plan mode 포함)." },
      { name: "plan_mode_ask_user_count", desc: "Plan Mode 내 AskUserQuestion 횟수 (EnterPlanMode ~ ExitPlanMode 사이). 패널티 없음." },
      { name: "penalized_ask_user_count", desc: "Plan Mode 밖 AskUserQuestion 횟수. 이것만 패널티로 적용됩니다." },
      { name: "autonomous_tool_call_pct", desc: "전체 tool call 중 penalized AskUser를 제외한 비율(%). (1 - penalized/total) * 100" },
    ],
    scoring: [
      { range: "0~2", meaning: "낮은 신뢰 (빈번한 개입, 적은 tool call/인간)" },
      { range: "2~5", meaning: "보통 수준 (~5-10 tool calls per human)" },
      { range: "5~8", meaning: "높은 신뢰 (~20-50 tool calls per human)" },
      { range: "8~10", meaning: "매우 높은 신뢰 (Z-thread 수준, 100+ tools/human)" },
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

/* ── Thread types ── */

export const THREAD_TYPES: ThreadTypeDef[] = [
  { type: "Z-thread", color: "#10B981", condition: "human_messages <= 1 AND tool_calls >= 10", desc: "Zero-touch: 최소 개입으로 대량의 자율 작업. 가장 진화된 형태." },
  { type: "B-thread", color: "#EF4444", condition: "max_sub_agent_depth >= 2", desc: "Big: 서브에이전트가 다시 서브에이전트를 생성하는 중첩 실행." },
  { type: "L-thread", color: "#22C55E", condition: "autonomous_stretch > 30min AND tool_calls > 50", desc: "Long: 인간 개입 없이 30분 이상 자율 실행." },
  { type: "F-thread", color: "#A855F7", condition: "sub_agent_prompt_similarity > 70% (Jaccard)", desc: "Fusion: 유사한 작업을 여러 서브에이전트에 분배 (Map-Reduce 패턴)." },
  { type: "P-thread", color: "#06B6D4", condition: "max_concurrent_agents > 1", desc: "Parallel: 2개 이상의 서브에이전트가 동시 실행." },
  { type: "C-thread", color: "#EAB308", condition: "human_messages >= 3 AND each_gap_tool_calls >= 3", desc: "Chained: 인간-AI 대화가 체인처럼 반복되며 진행." },
  { type: "Base", color: "#6B7280", condition: "위 조건 모두 해당 없음", desc: "기본 대화형 세션. 짧은 Q&A나 간단한 작업." },
];

/* ── Roadmap steps ── */

export const ROADMAP_STEPS: RoadmapStepDef[] = [
  { from: "Base", to: "C-thread", tip: "대화를 3턴 이상 이어가며 점진적으로 작업을 발전시키세요. 각 턴에서 3개 이상의 tool call이 발생하도록 요청하세요." },
  { from: "C-thread", to: "P-thread", tip: "독립적인 작업 2개 이상을 동시에 요청하세요. 'Agent tool로 병렬 처리해줘'라고 명시하면 효과적입니다." },
  { from: "P-thread", to: "L-thread", tip: "요구사항을 상세히 기술하고 중간 개입을 줄이세요. CLAUDE.md를 충실히 작성하면 질문 없이 30분 이상 자율 실행합니다." },
  { from: "L-thread", to: "B-thread", tip: "'팀을 구성해서 작업해줘', 'worktree에서 작업해줘' 등으로 깊은 서브에이전트 트리를 유도하세요." },
  { from: "B-thread", to: "Z-thread", tip: "궁극의 목표: 하나의 명령으로 기능 전체를 구현. Permission 자동 승인 + 상세한 프로젝트 문서 + 명확한 단일 지시." },
];

/* ── Tailwind color maps ── */

export const BORDER_COLORS: Record<string, string> = {
  cyan: "border-cyan-500/30",
  green: "border-green-500/30",
  red: "border-red-500/30",
  yellow: "border-yellow-500/30",
};

export const TEXT_COLORS: Record<string, string> = {
  cyan: "text-cyan-400",
  green: "text-green-400",
  red: "text-red-400",
  yellow: "text-yellow-400",
};

export const BG_COLORS: Record<string, string> = {
  cyan: "bg-cyan-500/10",
  green: "bg-green-500/10",
  red: "bg-red-500/10",
  yellow: "bg-yellow-500/10",
};
