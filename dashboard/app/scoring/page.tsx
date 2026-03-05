"use client";

import { useState } from "react";
import {
  DimensionConfig,
  ExampleDef,
  Lang,
  DIMENSIONS,
  THREAD_TYPES,
  ROADMAP_STEPS,
  PAGE_LABELS,
  THRESHOLD_ITEMS,
  TEXT_COLORS,
  BG_COLORS,
} from "./scoring-data";

/* ── Language toggle (EN / KO pill buttons) ── */

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex rounded-lg p-1" style={{ background: "#1A1A1A" }}>
      {(["en", "ko"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`px-3 py-1 rounded-md text-sm font-mono transition-colors ${
            lang === l ? "bg-cyan-600 text-white" : "text-gray-400 hover:text-white"
          }`}
        >
          {l === "en" ? "EN" : "KO"}
        </button>
      ))}
    </div>
  );
}

/* ── Hero (Pencil P8) ── */

function ScoringHero({ lang, onLangChange }: { lang: Lang; onLangChange: (l: Lang) => void }) {
  const L = PAGE_LABELS[lang];
  return (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[11px] font-mono tracking-wider mb-2" style={{ color: "#00FF88", letterSpacing: "0.5px" }}>
          {L.heroSub}
        </p>
        <h1 className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-1px" }}>
          {L.heroTitle}
        </h1>
        <p className="text-sm font-mono mt-1" style={{ color: "#8a8a8a" }}>
          {L.heroDesc}
        </p>
      </div>
      <LangToggle lang={lang} onChange={onLangChange} />
    </div>
  );
}

/* ── Overall composite formula card ── */

function OverallScoreCard({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  return (
    <section className="rounded-lg p-6" style={{ background: "#0A0A0A", border: "1px solid #2f2f2f" }}>
      <p className="text-[11px] font-mono text-gray-500 tracking-wider mb-2">{L.overallLabel}</p>
      <p className="font-mono text-sm font-semibold mb-2" style={{ color: "#00FF88" }}>{L.overallFormula}</p>
      <p className="text-xs text-gray-500">{L.overallNote}</p>
    </section>
  );
}

/* ── Single dimension card ── */

function DimensionCard({ dim }: { dim: DimensionConfig }) {
  const tc = TEXT_COLORS[dim.color];
  const bg = BG_COLORS[dim.color];

  return (
    <section className="rounded-lg p-6 space-y-4" style={{ background: "#0A0A0A", border: "1px solid #2f2f2f" }}>
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <h2 className={`text-lg font-bold ${tc}`}>{dim.title}</h2>
          <span className={`text-sm font-mono ${tc}`}>Max: {dim.maxScore}</span>
        </div>
        <p className="text-sm text-gray-400">{dim.subtitle}</p>
      </div>
      <FormulaBlock title={dim.formulaTitle} lines={dim.formula} colorClass={tc} />
      {dim.fullScoreNote && (
        <div className={`${bg} rounded p-3 flex items-start gap-2`}>
          <span className={`${tc} text-xs leading-none mt-[3px] shrink-0`}>★</span>
          <p className={`text-xs font-mono leading-relaxed ${tc}`}>{dim.fullScoreNote}</p>
        </div>
      )}
      <DetailBlock title={dim.detailTitle} lines={dim.detail} />
      {dim.examples && dim.examples.length > 0 && (
        <ExamplesBlock examples={dim.examples} colorClass={tc} bgClass={bg} />
      )}
      {dim.referenceTable && (
        <ReferenceGrid title={dim.referenceTable.title} rows={dim.referenceTable.rows} colorClass={tc} bgClass={bg} />
      )}
      <MetricsList metrics={dim.metrics} colorClass={tc} />
      <ScoreRangeGrid scoring={dim.scoring} colorClass={tc} bgClass={bg} />
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
      <div className="rounded p-3 font-mono text-xs text-gray-300 space-y-1" style={{ background: "#1A1A1A" }}>
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
      <div className="rounded p-3 text-xs text-gray-400 space-y-0.5" style={{ background: "#1A1A1A80" }}>
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

/* ── Examples block ── */

function ExamplesBlock({ examples, colorClass, bgClass }: {
  examples: ExampleDef[];
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Examples</h3>
      <div className="space-y-3">
        {examples.map((ex, i) => (
          <div key={i} className="rounded p-3" style={{ background: "#1A1A1A" }}>
            <p className={`text-xs font-semibold mb-1.5 ${colorClass}`}>{ex.title}</p>
            <div className="space-y-0.5 mb-2">
              {ex.lines.map((line, j) => (
                <p key={j} className="text-xs text-gray-400 font-mono">{line}</p>
              ))}
            </div>
            <div className={`${bgClass} rounded px-2 py-1 inline-block`}>
              <code className={`text-xs font-bold ${colorClass}`}>{ex.result}</code>
            </div>
          </div>
        ))}
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

function ThreadTypeSection({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  return (
    <section className="rounded-lg p-6" style={{ background: "#0A0A0A", border: "1px solid #2f2f2f" }}>
      <h2 className="text-lg font-bold text-white mb-4">{L.threadTitle}</h2>
      <p className="text-gray-400 text-sm mb-4">{L.threadDesc}</p>
      <div className="space-y-3">
        {THREAD_TYPES[lang].map((t) => (
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

function RoadmapSection({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  return (
    <section className="rounded-lg p-6" style={{ background: "#0A0A0A", border: "1px solid cyan", borderColor: "rgba(6,182,212,0.3)" }}>
      <h2 className="text-lg font-bold text-cyan-400 mb-4">{L.roadmapTitle}</h2>
      <p className="text-gray-400 text-sm mb-4">{L.roadmapDesc}</p>
      <div className="space-y-4">
        {ROADMAP_STEPS[lang].map((s) => (
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

function FairComparisonSection({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  return (
    <section className="rounded-lg p-6 space-y-5" style={{ background: "#0A0A0A", border: "1px solid cyan", borderColor: "rgba(6,182,212,0.3)" }}>
      <div>
        <h2 className="text-lg font-bold text-cyan-400 mb-3">{L.fairTitle}</h2>
        <p className="text-gray-300 text-sm leading-relaxed">{L.fairDesc}</p>
      </div>
      <ThresholdCards lang={lang} />
      <WeightedScoringBlock lang={lang} />
      <ConsistencyBlock lang={lang} />
      <CompositeRankBlock lang={lang} />
    </section>
  );
}

function ThresholdCards({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  const items = THRESHOLD_ITEMS[lang];
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{L.thresholdTitle}</h3>
      <p className="text-gray-400 text-xs mb-3">{L.thresholdDesc}</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((t) => (
          <div key={t.code} className="rounded p-3 text-center" style={{ background: "#1A1A1A" }}>
            <div className="text-cyan-400 font-mono text-lg font-bold">{t.value}</div>
            <div className="text-xs text-gray-400 mt-1">{t.label}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{t.code}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeightedScoringBlock({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{L.weightedTitle}</h3>
      <p className="text-gray-400 text-xs mb-3">{L.weightedDesc}</p>
      <div className="rounded p-4 font-mono text-xs text-gray-300 space-y-1" style={{ background: "#1A1A1A" }}>
        <p>weight(session) = log1p(total_tool_calls) * log1p(session_duration_minutes)</p>
        <p className="text-gray-500">weighted_score = &Sigma;(score_i * weight_i) / &Sigma;(weight_i)</p>
      </div>
    </div>
  );
}

function ConsistencyBlock({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{L.consistencyTitle}</h3>
      <p className="text-gray-400 text-xs mb-3">{L.consistencyDesc}</p>
      <div className="rounded p-4 font-mono text-xs text-gray-300 space-y-1" style={{ background: "#1A1A1A" }}>
        <p>consistency = max(0, min(10, 10 - std_dev * 3.33))</p>
        <p className="text-gray-500">std_dev = 0 &rarr; 10.0 ({lang === "en" ? "perfect consistency" : "완벽한 일관성"}) | std_dev &ge; 3 &rarr; ~0.0</p>
      </div>
    </div>
  );
}

function CompositeRankBlock({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{L.compositeTitle}</h3>
      <p className="text-gray-400 text-xs mb-3">{L.compositeDesc}</p>
      <div className="rounded p-3 font-mono text-xs text-gray-300" style={{ background: "#1A1A1A" }}>
        composite_rank = weighted_score * 0.8 + consistency * 0.2
      </div>
    </div>
  );
}

/* ── Data source info ── */

function DataSourceInfo({ lang }: { lang: Lang }) {
  const L = PAGE_LABELS[lang];
  return (
    <section className="rounded-lg p-4 text-xs text-gray-500" style={{ background: "#1A1A1A80" }}>
      <p className="font-semibold text-gray-400 mb-1">{L.dataSourceTitle}</p>
      <p>Claude Code JSONL {lang === "en" ? "session logs" : "세션 로그"}: <code>~/.claude/projects/&lt;hash&gt;/&lt;session&gt;.jsonl</code></p>
      <p className="mt-1">{lang === "en" ? "Sub-agent logs" : "서브에이전트 로그"}: <code>&lt;session-dir&gt;/subagents/agent-&lt;id&gt;.jsonl</code></p>
      <p className="mt-1"><code>omas scan</code> {lang === "en" ? "to scan all sessions" : "으로 전체 스캔"} &rarr; <code>omas export</code> {lang === "en" ? "to generate JSON" : "로 JSON 생성"}</p>
    </section>
  );
}

/* ── Page ── */

export default function ScoringGuidePage() {
  const [lang, setLang] = useState<Lang>("en");

  return (
    <div className="space-y-8 max-w-4xl">
      <ScoringHero lang={lang} onLangChange={setLang} />
      <OverallScoreCard lang={lang} />

      <div className="grid grid-cols-1 gap-6">
        {DIMENSIONS[lang].map((dim) => (
          <DimensionCard key={dim.title} dim={dim} />
        ))}
      </div>

      <ThreadTypeSection lang={lang} />
      <RoadmapSection lang={lang} />
      <FairComparisonSection lang={lang} />
      <DataSourceInfo lang={lang} />
    </div>
  );
}
