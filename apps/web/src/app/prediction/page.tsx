"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Database, Info, Languages, ShieldAlert, Target } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { manchesterRedXI } from "@/lib/mock-data";
import { ModelBadge } from "@/components/ModelBadge";
import { TopBar } from "@/components/TopBar";
import { ExportButton } from "@/components/ExportButton";
import {
  getMatchBundle,
  getDataCompleteness,
  type ApiMatch,
  type ApiPrediction,
  type DataCompletenessInfo,
  type Language,
} from "@/lib/api-client";

const copy = {
  zh: {
    title: "胜率推演",
    subtitle: "实时 API + 可审计模型证据",
    loading: "正在加载预测...",
    error: "API 暂不可用，已显示本地兜底数据。",
    homeWin: "主胜",
    draw: "平局",
    awayWin: "客胜",
    confidence: "置信度",
    expected: "预期进球",
    models: "模型与参考",
    features: "输入特征 / 贡献",
    explanation: "解释",
    goal: "可能进球人证据",
    card: "牌风险证据",
    disclaimer: "本工具仅用于解说辅助，不构成任何投注建议。AI改写模型输出，不创造概率。",
    dataCompleteness: "数据完整性",
    dataScore: "数据评分",
    missingFields: "缺失字段",
    confidenceCapped: "置信度已限制",
    confidenceCapNotice: (cap: number) =>
      `由于数据不完整，置信度上限已设为 ${Math.round(cap * 100)}%。预测结果可能不够精确。`,
    fallbackActive: "降级模式",
    noFallback: "无降级",
    dataSource: "数据来源",
    liveData: "实时数据",
    demoData: "演示数据",
    live: "实时",
    demo: "演示",
    complete: "完整",
    incomplete: "不完整",
  },
  en: {
    title: "Prediction",
    subtitle: "Live API + auditable model evidence",
    loading: "Loading prediction...",
    error: "API unavailable; showing local fallback data.",
    homeWin: "Home",
    draw: "Draw",
    awayWin: "Away",
    confidence: "Confidence",
    expected: "Expected goals",
    models: "Models and references",
    features: "Input features / contribution",
    explanation: "Explanation",
    goal: "Goal scorer evidence",
    card: "Card risk evidence",
    disclaimer: "For commentary assistance only, not betting advice. AI rewrites model outputs; it does not invent probabilities.",
    dataCompleteness: "Data Completeness",
    dataScore: "Data Score",
    missingFields: "Missing Fields",
    confidenceCapped: "Confidence Capped",
    confidenceCapNotice: (cap: number) =>
      `Confidence is capped at ${Math.round(cap * 100)}% due to incomplete data. Predictions may be less precise.`,
    fallbackActive: "Fallback Active",
    noFallback: "No Fallback",
    dataSource: "Data Source",
    liveData: "Live Data",
    demoData: "Demo Data",
    live: "Live",
    demo: "Demo",
    complete: "Complete",
    incomplete: "Incomplete",
  },
};

export default function PredictionPage() {
  const [language, setLanguage] = useState<Language>("zh");
  const [match, setMatch] = useState<ApiMatch | null>(null);
  const [prediction, setPrediction] = useState<ApiPrediction | null>(null);
  const [completeness, setCompleteness] = useState<DataCompletenessInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMatchBundle()
      .then((bundle) => {
        if (!active) return;
        setMatch(bundle.match);
        setPrediction(bundle.prediction);
        setError(null);
        // Load completeness after prediction data arrives
        return getDataCompleteness();
      })
      .then((info) => {
        if (!active || !info) return;
        setCompleteness(info);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const text = copy[language === "en" ? "en" : "zh"];
  const subtitle = useMemo(() => {
    if (!match) return text.subtitle;
    return `${match.homeTeam.name} vs ${match.awayTeam.name} · ${match.competition ?? match.status}`;
  }, [match, text.subtitle]);

  return (
    <div className="min-h-screen">
      <TopBar title={text.title} subtitle={subtitle} />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Languages className="h-3.5 w-3.5" />
            {language === "bilingual" ? "中文 / English" : language.toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              allowedFormats={["predictions-csv", "full-zip"]}
              matchId={match?.matchId}
            />
            {completeness && (
              <span
                className={`badge text-[10px] ${
                  completeness.dataSource === "live"
                    ? "badge-green"
                    : "badge-amber"
                }`}
              >
                {completeness.dataSource === "live"
                  ? (language === "en" ? "Live" : "实时")
                  : (language === "en" ? "Demo" : "演示")}
              </span>
            )}
            <div className="flex rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-1">
              {(["zh", "en", "bilingual"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setLanguage(item)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    language === item
                      ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item === "zh" ? "中文" : item === "en" ? "EN" : "双语"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && <div className="card text-sm text-[var(--text-muted)]">{text.loading}</div>}
        {error && (
          <div className="card border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/5 text-sm text-[var(--accent-amber)]">
            {text.error}
          </div>
        )}

        {prediction && match && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Animated Probability Bars */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="card space-y-4"
              >
                <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  {language === "en" ? "Win Probabilities" : language === "bilingual" ? "胜率概率 / Win Probabilities" : "胜率概率"}
                </div>
                <AnimatedProbBar label={text.homeWin} value={prediction.homeWin} color="var(--accent-green)" delay={0.1} />
                <AnimatedProbBar label={text.draw} value={prediction.draw} color="var(--accent-amber)" delay={0.25} />
                <AnimatedProbBar label={text.awayWin} value={prediction.awayWin} color="var(--accent-blue)" delay={0.4} />
              </motion.div>
              {/* Confidence Gauge Ring */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="card flex items-center justify-center py-6"
              >
                <ConfidenceGaugeRing confidence={prediction.confidence} label={text.confidence} language={language} />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <XGComparisonInline
                homeTeam={match.homeTeam.name}
                awayTeam={match.awayTeam.name}
                homeXG={prediction.expectedHomeGoals}
                awayXG={prediction.expectedAwayGoals}
                language={language}
              />
            </motion.div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="card space-y-3 xl:col-span-5">
                <SectionTitle>{text.models}</SectionTitle>
                <div className="flex flex-wrap gap-2">
                  {prediction.models.map((model) => (
                    <ModelBadge key={`${model.name}-${model.version}`} name={model.name} version={model.version} />
                  ))}
                </div>
                <div className="space-y-2">
                  {prediction.models.map((model) => (
                    <div key={model.name} className="rounded bg-[var(--bg-primary)] p-3 text-xs">
                      <div className="font-medium text-[var(--accent-purple)]">{model.name} v{model.version ?? "n/a"}</div>
                      <div className="break-words text-[var(--text-muted)]">{model.reference ?? "No public reference supplied"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card space-y-3 xl:col-span-7">
                <SectionTitle>{text.features}</SectionTitle>
                <div className="space-y-2">
                  {prediction.featureContributions.map((item) => (
                    <div key={item.feature} className="grid gap-2 rounded bg-[var(--bg-primary)] p-2 text-xs sm:grid-cols-[minmax(0,1fr)_96px]">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[var(--accent-blue)]">{item.feature}</div>
                        <div className="line-clamp-2 text-[var(--text-muted)]">{item.evidence}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-card)]">
                          <div className="h-full rounded-full bg-[var(--accent-green)]" style={{ width: `${item.contribution}%` }} />
                        </div>
                        <span className="w-8 text-right tabular-nums">{item.contribution}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <EvidenceCard title={text.goal} icon={<Target className="h-4 w-4 text-[var(--accent-green)]" />} items={prediction.goalScorers.map((item) => ({
                name: item.player,
                value: `${item.probability}%`,
                color: "var(--accent-green)",
                evidence: item.evidence,
              }))} />
              <EvidenceCard title={text.card} icon={<AlertTriangle className="h-4 w-4 text-[var(--accent-amber)]" />} items={prediction.cardRisks.map((item) => ({
                name: item.player,
                value: `${item.yellowRisk}%`,
                color: "var(--accent-amber)",
                evidence: [...item.evidence, `Red risk: ${item.redRisk}`],
              }))} />
              <div className="card space-y-3 xl:col-span-4">
                <SectionTitle>{text.explanation}</SectionTitle>
                <div className="space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {prediction.explanations.map((item) => (
                    <p key={item}>{language === "bilingual" ? `${item}\n${item}` : item}</p>
                  ))}
                </div>
              </div>
            </div>

            <div className="card space-y-2 border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/5">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-amber)]">
                <Info className="h-3.5 w-3.5" />
                {language === "en" ? "Important" : "重要声明"}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {language === "bilingual" ? `${copy.zh.disclaimer}\n${copy.en.disclaimer}` : text.disclaimer}
              </p>
            </div>

            {/* Data Completeness Section */}
            {completeness && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Database className="h-4 w-4 text-[var(--accent-blue)]" />
                    {language === "bilingual"
                      ? `${copy.zh.dataCompleteness} / ${copy.en.dataCompleteness}`
                      : text.dataCompleteness}
                  </div>
                  <span
                    className={`badge text-[10px] ${
                      completeness.dataSource === "live"
                        ? "badge-green"
                        : "badge-amber"
                    }`}
                  >
                    {completeness.dataSource === "live"
                      ? (language === "en" ? "Live" : "实时")
                      : (language === "en" ? "Demo" : "演示")}
                  </span>
                </div>

                {/* Score bar and status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">
                      {language === "bilingual"
                        ? `${copy.zh.dataScore} / ${copy.en.dataScore}`
                        : text.dataScore}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        completeness.score >= 80
                          ? "text-[var(--accent-green)]"
                          : completeness.score >= 60
                            ? "text-[var(--accent-amber)]"
                            : "text-[var(--accent-red)]"
                      }`}
                    >
                      {completeness.score}/100
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${completeness.score}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        completeness.score >= 80
                          ? "bg-[var(--accent-green)]"
                          : completeness.score >= 60
                            ? "bg-[var(--accent-amber)]"
                            : "bg-[var(--accent-red)]"
                      }`}
                    />
                  </div>
                </div>

                {/* Missing fields as red badges */}
                {completeness.missingFields.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <ShieldAlert className="h-3.5 w-3.5 text-[var(--accent-red)]" />
                      {language === "bilingual"
                        ? `${copy.zh.missingFields} / ${copy.en.missingFields}`
                        : text.missingFields}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {completeness.missingFields.map((field) => (
                        <span key={field} className="badge-red text-[10px]">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Confidence cap warning banner */}
                {completeness.confidenceCap < 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-2 rounded border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/5 px-3 py-2"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--accent-amber)]" />
                    <div className="space-y-1 text-xs">
                      <div className="font-medium text-[var(--accent-amber)]">
                        {language === "bilingual"
                          ? `${copy.zh.confidenceCapped} / ${copy.en.confidenceCapped}`
                          : text.confidenceCapped}
                      </div>
                      <p className="text-[var(--text-secondary)]">
                        {language === "bilingual"
                          ? `${copy.zh.confidenceCapNotice(completeness.confidenceCap)}\n${copy.en.confidenceCapNotice(completeness.confidenceCap)}`
                          : text.confidenceCapNotice(completeness.confidenceCap)}
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Degraded reasons and fallback method */}
                {completeness.degradedReasons.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-[var(--text-muted)]">
                      {language === "bilingual"
                        ? `${copy.zh.fallbackActive} / ${copy.en.fallbackActive}`
                        : text.fallbackActive}
                    </div>
                    <div className="space-y-1">
                      {completeness.degradedReasons.map((reason) => (
                        <div
                          key={reason}
                          className="flex items-start gap-2 rounded bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-secondary)]"
                        >
                          <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-[var(--accent-amber)]" />
                          {reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback method description */}
                {completeness.fallbackMethod && (
                  <div className="rounded bg-[var(--bg-primary)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    <span className="font-medium text-[var(--accent-purple)]">
                      {language === "en" ? "Fallback method:" : "降级方案:"}
                    </span>{" "}
                    {completeness.fallbackMethod}
                  </div>
                )}

                {/* Data source indicator */}
                <div className="flex items-center gap-2 rounded bg-[var(--bg-primary)] px-3 py-2 text-xs">
                  <span className="text-[var(--text-muted)]">
                    {language === "bilingual"
                      ? `${copy.zh.dataSource} / ${copy.en.dataSource}`
                      : text.dataSource}
                  </span>
                  <span
                    className={`badge text-[10px] ${
                      completeness.dataSource === "live"
                        ? "badge-green"
                        : "badge-amber"
                    }`}
                  >
                    {completeness.dataSource === "live"
                      ? (language === "en" ? "Live API" : "实时 API")
                      : (language === "en" ? "Demo / Fallback" : "演示 / 降级")}
                  </span>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScoreBlock({ team, value, color }: { team: string; value: number; color: string }) {
  return (
    <div className="min-w-32 text-center">
      <div className="truncate text-xs text-[var(--text-muted)]">{team}</div>
      <div className="text-4xl font-bold tabular-nums" style={{ color }}>
        {value.toFixed(1)}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{children}</div>;
}

function EvidenceCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; value: string; color: string; evidence: string[] }[];
}) {
  return (
    <div className="card space-y-3 xl:col-span-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="rounded bg-[var(--bg-primary)] p-2">
            <div className="flex items-center gap-3">
              <span className="w-4 text-xs text-[var(--text-muted)]">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
              <span className="text-sm tabular-nums" style={{ color: item.color }}>
                {item.value}
              </span>
            </div>
            <div className="mt-1 space-y-1 pl-7 text-xs leading-relaxed text-[var(--text-muted)]">
              {item.evidence.slice(0, 2).map((line) => (
                <div key={line} className="line-clamp-2">{line}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
