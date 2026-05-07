"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ApiPrediction } from "@/lib/api-client";

// ── Shared constants ────────────────────────────────────────────────

const COLORS = {
  home: "#10b981",   // --accent-green
  draw: "#f59e0b",   // --accent-amber
  away: "#3b82f6",   // --accent-blue
  conf: "#8b5cf6",   // --accent-purple
  grid: "#2a3550",   // --border-color
  muted: "#6b7280",  // --text-muted
  bgCard: "#1a2236", // --bg-card
  bgPrimary: "#0a0e17", // --bg-primary
};

const SCORER_COLORS = [
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#f97316",
];

interface PredictionChartProps {
  prediction: ApiPrediction;
  homeTeamName?: string;
  awayTeamName?: string;
  language?: "zh" | "en";
}

// ── Custom Tooltip ──────────────────────────────────────────────────

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-lg"
      style={{
        backgroundColor: COLORS.bgCard,
        borderColor: COLORS.grid,
        color: "#e5e7eb",
      }}
    >
      {label && <div className="mb-1 font-medium">{label}</div>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="font-medium tabular-nums">{entry.value}%</span>
        </div>
      ))}
    </div>
  );
}

// ── 1. Stacked Bar Chart: H / D / A probabilities ───────────────────

function HDABarChart({
  prediction,
  homeTeamName,
  awayTeamName,
  language,
}: {
  prediction: ApiPrediction;
  homeTeamName?: string;
  awayTeamName?: string;
  language: "zh" | "en";
}) {
  const t = (zh: string, en: string) => (language === "zh" ? zh : en);

  const data = useMemo(
    () => [
      {
        name: homeTeamName ?? t("主队", "Home"),
        homeWin: prediction.homeWin,
        draw: prediction.draw,
        awayWin: prediction.awayWin,
      },
    ],
    [prediction, homeTeamName, t],
  );

  return (
    <div className="card space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {t("胜平负概率", "H / D / A Probabilities")}
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, left: 12, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={COLORS.grid}
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              axisLine={{ stroke: COLORS.grid }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="homeWin"
              name={t("主胜", "Home Win")}
              stackId="a"
              fill={COLORS.home}
              radius={[4, 0, 0, 4]}
            />
            <Bar
              dataKey="draw"
              name={t("平局", "Draw")}
              stackId="a"
              fill={COLORS.draw}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="awayWin"
              name={t("客胜", "Away Win")}
              stackId="a"
              fill={COLORS.away}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
        {[
          { label: t("主胜", "Home"), color: COLORS.home, value: prediction.homeWin },
          { label: t("平局", "Draw"), color: COLORS.draw, value: prediction.draw },
          { label: t("客胜", "Away"), color: COLORS.away, value: prediction.awayWin },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[var(--text-muted)]">{item.label}</span>
            <span className="font-medium tabular-nums text-[var(--text-primary)]">
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 2. Gauge Chart: Confidence ──────────────────────────────────────

function ConfidenceGauge({
  confidence,
  language,
}: {
  confidence: number;
  language: "zh" | "en";
}) {
  const t = (zh: string, en: string) => (language === "zh" ? zh : en);

  // Gauge uses a semi-circle pie chart
  const gaugeColor = useMemo(() => {
    if (confidence >= 75) return COLORS.home;
    if (confidence >= 50) return COLORS.draw;
    return COLORS.away;
  }, [confidence]);

  const gaugeData = useMemo(
    () => [
      { name: "value", value: confidence },
      { name: "remainder", value: 100 - confidence },
    ],
    [confidence],
  );

  return (
    <div className="card space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {t("置信度", "Confidence")}
      </div>
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="70%"
              startAngle={180}
              endAngle={0}
              innerRadius="55%"
              outerRadius="85%"
              dataKey="value"
              stroke="none"
              cornerRadius={4}
            >
              <Cell fill={gaugeColor} />
              <Cell fill={COLORS.grid} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-4">
          <div className="text-3xl font-bold tabular-nums" style={{ color: gaugeColor }}>
            {confidence}%
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {confidence >= 75
              ? t("高置信", "High")
              : confidence >= 50
                ? t("中置信", "Medium")
                : t("低置信", "Low")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 3. xG Comparison Bar Chart ──────────────────────────────────────

function XGComparisonChart({
  prediction,
  homeTeamName,
  awayTeamName,
  language,
}: {
  prediction: ApiPrediction;
  homeTeamName?: string;
  awayTeamName?: string;
  language: "zh" | "en";
}) {
  const t = (zh: string, en: string) => (language === "zh" ? zh : en);

  const data = useMemo(
    () => [
      {
        name: homeTeamName ?? t("主队", "Home"),
        xG: prediction.expectedHomeGoals,
        fill: COLORS.home,
      },
      {
        name: awayTeamName ?? t("客队", "Away"),
        xG: prediction.expectedAwayGoals,
        fill: COLORS.away,
      },
    ],
    [prediction, homeTeamName, awayTeamName, t],
  );

  const maxXG = Math.max(
    prediction.expectedHomeGoals,
    prediction.expectedAwayGoals,
    1,
  );

  return (
    <div className="card space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {t("预期进球对比", "Expected Goals Comparison")}
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 16, right: 12, left: 12, bottom: 4 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={COLORS.grid}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              axisLine={{ stroke: COLORS.grid }}
              tickLine={false}
            />
            <YAxis
              domain={[0, Math.ceil(maxXG + 1)]}
              tick={{ fill: COLORS.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip
              formatter={(value: number) => [value.toFixed(2), "xG"]}
              contentStyle={{
                backgroundColor: COLORS.bgCard,
                borderColor: COLORS.grid,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e5e7eb" }}
              itemStyle={{ color: "#e5e7eb" }}
            />
            <Bar dataKey="xG" radius={[6, 6, 0, 0]} barSize={56}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Numeric summary */}
      <div className="flex items-center justify-center gap-8 text-sm">
        <div className="text-center">
          <div className="text-xs text-[var(--text-muted)]">
            {homeTeamName ?? t("主队", "Home")}
          </div>
          <div className="text-xl font-bold tabular-nums text-[var(--accent-green)]">
            {prediction.expectedHomeGoals.toFixed(2)}
          </div>
        </div>
        <div className="text-xs text-[var(--text-muted)]">vs</div>
        <div className="text-center">
          <div className="text-xs text-[var(--text-muted)]">
            {awayTeamName ?? t("客队", "Away")}
          </div>
          <div className="text-xl font-bold tabular-nums text-[var(--accent-blue)]">
            {prediction.expectedAwayGoals.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 4. Scorer Probability Pie Chart ─────────────────────────────────

function ScorerPieChart({
  goalScorers,
  language,
}: {
  goalScorers: ApiPrediction["goalScorers"];
  language: "zh" | "en";
}) {
  const t = (zh: string, en: string) => (language === "zh" ? zh : en);

  const data = useMemo(
    () =>
      goalScorers.slice(0, 8).map((scorer, i) => ({
        name: scorer.player,
        value: scorer.probability,
        fill: SCORER_COLORS[i % SCORER_COLORS.length],
      })),
    [goalScorers],
  );

  const totalProb = useMemo(
    () => data.reduce((sum, d) => sum + d.value, 0),
    [data],
  );

  return (
    <div className="card space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {t("进球概率分布", "Goal Scorer Probabilities")}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="70%"
              dataKey="value"
              stroke="none"
              paddingAngle={2}
              label={({ name, percent }) =>
                `${name.length > 10 ? name.slice(0, 10) + "..." : name} ${(percent * 100).toFixed(0)}%`
              }
              labelLine={{ stroke: COLORS.muted, strokeWidth: 1 }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [`${value}%`, t("概率", "Probability")]}
              contentStyle={{
                backgroundColor: COLORS.bgCard,
                borderColor: COLORS.grid,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#e5e7eb" }}
              itemStyle={{ color: "#e5e7eb" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend list */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.fill }}
            />
            <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">
              {entry.name}
            </span>
            <span className="tabular-nums font-medium">{entry.value}%</span>
          </div>
        ))}
      </div>
      {totalProb < 100 && (
        <div className="text-center text-[10px] text-[var(--text-muted)]">
          {t("其他球员", "Others")}: {(100 - totalProb).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

// ── Main Export ─────────────────────────────────────────────────────

export function PredictionChart({
  prediction,
  homeTeamName,
  awayTeamName,
  language = "zh",
}: PredictionChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid gap-4 sm:grid-cols-2"
    >
      {/* Row 1: HDA stacked bar + Confidence gauge */}
      <HDABarChart
        prediction={prediction}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        language={language}
      />
      <ConfidenceGauge
        confidence={prediction.confidence}
        language={language}
      />

      {/* Row 2: xG comparison + Scorer pie */}
      <XGComparisonChart
        prediction={prediction}
        homeTeamName={homeTeamName}
        awayTeamName={awayTeamName}
        language={language}
      />
      <ScorerPieChart
        goalScorers={prediction.goalScorers}
        language={language}
      />
    </motion.div>
  );
}
