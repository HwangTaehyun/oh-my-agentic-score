"use client";

import {
  DimensionConfig,
  DIMENSIONS,
  THREAD_TYPES,
  ROADMAP_STEPS,
  BORDER_COLORS,
  TEXT_COLORS,
  BG_COLORS,
} from "./scoring-data";

/* ── Hero (Pencil P8) ── */

function ScoringHero() {
  return (
    <div>
      <p className="text-xs font-mono tracking-wider mb-1" style={{ color: "#00FF88" }}>
        // HOW SCORES ARE CALCULATED
      </p>
      <h1 className="text-4xl font-bold text-white tracking-tight">Scoring Guide</h1>
      <p className="text-sm text-gray-400 mt-1">
        Thread-based engineering metrics across 4 dimensions
      </p>
    </div>
  );
}

/* ── Overall composite formula card ── */

function OverallScoreCard() {
  return (
    <section className="bg-gray-900 rounded-lg border border-gray-700 p-6">
      <p className="text-[11px] font-mono text-gray-500 tracking-wider mb-2">
        OVERALL COMPOSITE SCORE
      </p>
      <p className="font-mono text-sm font-semibold mb-2" style={{ color: "#00FF88" }}>
        composite = (More + Longer + Thicker + Fewer) / 4
      </p>
      <p className="text-xs text-gray-500">
        Each dimension is scored 0-10. The overall score is the simple average of all four.
      </p>
    </section>
  );
}

/* ── Single dimension card ── */

function DimensionCard({ dim }: { dim: DimensionConfig }) {
  const tc = TEXT_COLORS[dim.color];
  const bc = BORDER_COLORS[dim.color];
  const bg = BG_COLORS[dim.color];

  return (
    <section className={`bg-gray-900 rounded-lg border ${bc} p-6 space-y-4`}>
      {/* Header */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <h2 className={`text-lg font-bold ${tc}`}>{dim.title}</h2>
          <span className={`text-sm font-mono ${tc}`}>Max: {dim.maxScore}</span>
        </div>
        <p className="text-sm text-gray-400">{dim.subtitle}</p>
      </div>

      {/* Formula */}
      <FormulaBlock title={dim.formulaTitle} lines={dim.formula} colorClass={tc} />

      {/* Detail */}
      <DetailBlock title={dim.detailTitle} lines={dim.detail} />

      {/* Reference table */}
      {dim.referenceTable && (
        <ReferenceGrid
          title={dim.referenceTable.title}
          rows={dim.referenceTable.rows}
          colorClass={tc}
          bgClass={bg}
        />
      )}

      {/* Metrics */}
      <MetricsList metrics={dim.metrics} colorClass={tc} />

      {/* Score ranges */}
      <ScoreRangeGrid scoring={dim.scoring} colorClass={tc} bgClass={bg} />

      {/* Tips */}
      <TipsList tips={dim.tips} colorClass={tc} />
    </section>
  );
}

/* ── Formula code block ── */

function FormulaBlock({ title, lines, colorClass }: {
  title: string;
  lines: { code: string; comment: string | null }[];
  colorClass: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{title}</h3>
      <div className="bg-gray-800 rounded p-3 font-mono text-xs text-gray-300 space-y-1">
        {lines.map((f, i) => (
          <div key={i}>
            <code className={colorClass}>{f.code}</code>
            {f.comment && <span className="text-gray-500 ml-2">// {f.comment}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Detail algorithm block ── */

function DetailBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{title}</h3>
      <div className="bg-gray-800/50 rounded p-3 text-xs text-gray-400 space-y-0.5">
        {lines.map((line, i) =>
          line === "" ? (
            <div key={i} className="h-1" />
          ) : (
            <p key={i} className={line.startsWith("   ") ? "text-gray-500 pl-2" : ""}>
              {line}
            </p>
          ),
        )}
      </div>
    </div>
  );
}

/* ── Reference table grid ── */

function ReferenceGrid({ title, rows, colorClass, bgClass }: {
  title: string;
  rows: { input: string; score: string }[];
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{title}</h3>
      <div className="grid grid-cols-4 md:grid-cols-7 gap-1">
        {rows.map((row) => (
          <div key={row.input} className={`${bgClass} rounded p-1.5 text-center`}>
            <div className="text-[10px] text-gray-400">{row.input}</div>
            <div className={`text-xs font-bold font-mono ${colorClass}`}>{row.score}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Metrics list ── */

function MetricsList({ metrics, colorClass }: {
  metrics: { name: string; desc: string }[];
  colorClass: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Metrics</h3>
      <div className="space-y-2">
        {metrics.map((m) => (
          <div key={m.name} className="flex gap-3 text-sm">
            <code className={`shrink-0 ${colorClass} text-xs`}>{m.name}</code>
            <span className="text-gray-400 text-xs">{m.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Score range grid ── */

function ScoreRangeGrid({ scoring, colorClass, bgClass }: {
  scoring: { range: string; meaning: string }[];
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Score Ranges</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {scoring.map((s) => (
          <div key={s.range} className={`${bgClass} rounded p-2 text-center`}>
            <div className={`text-sm font-bold font-mono ${colorClass}`}>{s.range}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.meaning}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tips list ── */

function TipsList({ tips, colorClass }: { tips: string[]; colorClass: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">How to Improve</h3>
      <ul className="space-y-1">
        {tips.map((tip, i) => (
          <li key={i} className="text-sm text-gray-400 flex gap-2">
            <span className={`${colorClass} shrink-0`}>&rarr;</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Thread type classification section ── */

function ThreadTypeSection() {
  return (
    <section className="bg-gray-900 rounded-lg border border-gray-700 p-6">
      <h2 className="text-lg font-bold text-white mb-4">Thread Type Classification</h2>
      <p className="text-gray-400 text-sm mb-4">
        세션은 아래 우선순위 순서로 한 가지 유형으로 분류됩니다 (Z가 가장 높은 우선순위):
      </p>
      <div className="space-y-3">
        {THREAD_TYPES.map((t) => (
          <div key={t.type} className="flex items-start gap-3 text-sm">
            <span
              className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: t.color + "22", color: t.color }}
            >
              {t.type}
            </span>
            <div>
              <code className="text-xs text-gray-500">{t.condition}</code>
              <p className="text-gray-400 text-xs mt-0.5">{t.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Improvement roadmap section ── */

function RoadmapSection() {
  return (
    <section className="bg-gray-900 rounded-lg border border-cyan-500/30 p-6">
      <h2 className="text-lg font-bold text-cyan-400 mb-4">Improvement Roadmap</h2>
      <p className="text-gray-400 text-sm mb-4">
        Base &rarr; C &rarr; P &rarr; L &rarr; B &rarr; Z 순서로 진화하세요. 각 단계별 핵심 전략:
      </p>
      <div className="space-y-4">
        {ROADMAP_STEPS.map((s) => (
          <div key={s.to} className="flex items-start gap-3">
            <div className="flex items-center gap-1 shrink-0 text-xs font-mono">
              <span className="text-gray-500">{s.from}</span>
              <span className="text-cyan-400">&rarr;</span>
              <span className="text-white">{s.to}</span>
            </div>
            <p className="text-sm text-gray-400">{s.tip}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Fair comparison section ── */

function FairComparisonSection() {
  return (
    <section className="bg-gray-900 rounded-lg border border-cyan-500/30 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-cyan-400 mb-3">Fair Comparison System</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          공정한 비교를 위해 세션을 필터링하고 가중치를 부여하는 시스템입니다.
          짧은 테스트 세션이나 자동화 스크립트가 전체 점수를 왜곡하지 않도록 합니다.
        </p>
      </div>

      <ThresholdCards />
      <WeightedScoringBlock />
      <ConsistencyBlock />
      <CompositeRankBlock />
    </section>
  );
}

function ThresholdCards() {
  const items = [
    { value: "5 min", label: "최소 세션 시간", code: "session_duration_minutes" },
    { value: "10 calls", label: "최소 tool call 수", code: "total_tool_calls" },
    { value: "1 msg", label: "최소 human message 수", code: "total_human_messages" },
  ];
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Minimum Qualifying Thresholds</h3>
      <p className="text-gray-400 text-xs mb-3">
        아래 기준을 모두 충족해야 비교 대상으로 포함됩니다.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((t) => (
          <div key={t.code} className="bg-gray-800 rounded p-3 text-center">
            <div className="text-cyan-400 font-mono text-lg font-bold">{t.value}</div>
            <div className="text-xs text-gray-400 mt-1">{t.label}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{t.code}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeightedScoringBlock() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Weighted Scoring</h3>
      <p className="text-gray-400 text-xs mb-3">
        더 길고 복잡한 세션에 더 많은 가중치를 부여합니다.
      </p>
      <div className="bg-gray-800 rounded p-4 font-mono text-xs text-gray-300 space-y-1">
        <p>weight(session) = log1p(total_tool_calls) * log1p(session_duration_minutes)</p>
        <p className="text-gray-500">weighted_score = &Sigma;(score_i * weight_i) / &Sigma;(weight_i)</p>
      </div>
    </div>
  );
}

function ConsistencyBlock() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Consistency Score (0~10)</h3>
      <p className="text-gray-400 text-xs mb-3">
        최근 20개 세션의 overall score 표준편차를 기반으로 일관성을 측정합니다.
      </p>
      <div className="bg-gray-800 rounded p-4 font-mono text-xs text-gray-300 space-y-1">
        <p>consistency = max(0, min(10, 10 - std_dev * 3.33))</p>
        <p className="text-gray-500">std_dev = 0 &rarr; 10.0 (완벽한 일관성) | std_dev &ge; 3 &rarr; ~0.0</p>
      </div>
    </div>
  );
}

function CompositeRankBlock() {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Composite Rank Score</h3>
      <p className="text-gray-400 text-xs mb-3">
        가중 점수(80%)와 일관성 점수(20%)를 결합한 최종 비교 순위 점수입니다.
      </p>
      <div className="bg-gray-800 rounded p-3 font-mono text-xs text-gray-300">
        composite_rank = weighted_score * 0.8 + consistency * 0.2
      </div>
    </div>
  );
}

/* ── Data source info ── */

function DataSourceInfo() {
  return (
    <section className="bg-gray-800/50 rounded-lg p-4 text-xs text-gray-500">
      <p className="font-semibold text-gray-400 mb-1">Data Source</p>
      <p>Claude Code JSONL 세션 로그: <code>~/.claude/projects/&lt;hash&gt;/&lt;session&gt;.jsonl</code></p>
      <p className="mt-1">서브에이전트 로그: <code>&lt;session-dir&gt;/subagents/agent-&lt;id&gt;.jsonl</code></p>
      <p className="mt-1"><code>omas scan</code>으로 전체 스캔 &rarr; <code>omas export</code>로 JSON 생성</p>
    </section>
  );
}

/* ── Page ── */

export default function ScoringGuidePage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <ScoringHero />
      <OverallScoreCard />

      <div className="grid grid-cols-1 gap-6">
        {DIMENSIONS.map((dim) => (
          <DimensionCard key={dim.title} dim={dim} />
        ))}
      </div>

      <ThreadTypeSection />
      <RoadmapSection />
      <FairComparisonSection />
      <DataSourceInfo />
    </div>
  );
}
