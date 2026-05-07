"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpDown,
  CircleDot,
  Clock,
  CornerUpRight,
  Eye,
  Flag,
  Minus,
  Monitor,
  Square,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Event types ─────────────────────────────────────────────────────

export type MatchEventType =
  | "goal"
  | "own_goal"
  | "penalty_scored"
  | "penalty_missed"
  | "yellow_card"
  | "red_card"
  | "second_yellow"
  | "substitution"
  | "var_decision"
  | "kick_off"
  | "half_time"
  | "full_time"
  | "extra_time"
  | "corner";

export type MatchEventSide = "home" | "away" | "neutral";

export interface MatchEvent {
  id: string;
  minute: number;
  addedTime?: number;
  type: MatchEventType;
  side: MatchEventSide;
  player?: string;
  assistPlayer?: string;
  detail?: string;
}

export interface XGDataPoint {
  minute: number;
  homeXG: number;
  awayXG: number;
  label?: string;
}

export interface MatchTimelineProps {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  events?: MatchEvent[];
  xgData?: XGDataPoint[];
  lang?: "zh" | "en";
}

// ── Demo data generator ─────────────────────────────────────────────

function generateDemoEvents(homeTeam: string, awayTeam: string): MatchEvent[] {
  return [
    { id: "ko", minute: 0, type: "kick_off", side: "neutral", detail: "Match started" },
    { id: "g1", minute: 12, type: "goal", side: "home", player: "V. Finish", assistPlayer: "B. Vision", detail: "Right foot, bottom corner" },
    { id: "c1", minute: 23, type: "yellow_card", side: "away", player: "D. Anchor", detail: "Tactical foul on counter-attack" },
    { id: "c2", minute: 28, type: "corner", side: "home" },
    { id: "g2", minute: 34, type: "goal", side: "away", player: "H. Counter", assistPlayer: "L. Cross", detail: "Header from corner" },
    { id: "ht", minute: 45, type: "half_time", side: "neutral", addedTime: 1, detail: "Half Time" },
    { id: "s1", minute: 55, type: "substitution", side: "home", player: "M. Fresh", detail: "On for C. Press" },
    { id: "c3", minute: 62, type: "yellow_card", side: "home", player: "R. Block", detail: "Late challenge" },
    { id: "g3", minute: 68, type: "goal", side: "home", player: "J. Spark", detail: "Solo run, left foot finish" },
    { id: "s2", minute: 72, type: "substitution", side: "away", player: "T. Pace", detail: "On for K. Slow" },
    { id: "c4", minute: 78, type: "corner", side: "away" },
    { id: "g4", minute: 85, type: "goal", side: "away", player: "L. Cross", assistPlayer: "T. Pace", detail: "Volley from edge of box" },
    { id: "s3", minute: 88, type: "substitution", side: "home", player: "D. Shield", detail: "On for J. Spark" },
    { id: "ft", minute: 90, type: "full_time", side: "neutral", addedTime: 3, detail: "Full Time" },
  ];
}

function generateDemoXG(): XGDataPoint[] {
  return [
    { minute: 0, homeXG: 0, awayXG: 0 },
    { minute: 5, homeXG: 0.05, awayXG: 0.02 },
    { minute: 10, homeXG: 0.12, awayXG: 0.04 },
    { minute: 12, homeXG: 0.45, awayXG: 0.04, label: "Goal" },
    { minute: 15, homeXG: 0.48, awayXG: 0.06 },
    { minute: 20, homeXG: 0.55, awayXG: 0.1 },
    { minute: 25, homeXG: 0.58, awayXG: 0.15 },
    { minute: 30, homeXG: 0.62, awayXG: 0.28 },
    { minute: 34, homeXG: 0.62, awayXG: 0.65, label: "Goal" },
    { minute: 38, homeXG: 0.7, awayXG: 0.68 },
    { minute: 42, homeXG: 0.78, awayXG: 0.72 },
    { minute: 45, homeXG: 0.82, awayXG: 0.75 },
    { minute: 50, homeXG: 0.88, awayXG: 0.78 },
    { minute: 55, homeXG: 0.95, awayXG: 0.82 },
    { minute: 60, homeXG: 1.02, awayXG: 0.85 },
    { minute: 65, homeXG: 1.18, awayXG: 0.88 },
    { minute: 68, homeXG: 1.52, awayXG: 0.88, label: "Goal" },
    { minute: 72, homeXG: 1.55, awayXG: 0.92 },
    { minute: 75, homeXG: 1.58, awayXG: 1.0 },
    { minute: 78, homeXG: 1.6, awayXG: 1.05 },
    { minute: 80, homeXG: 1.62, awayXG: 1.12 },
    { minute: 85, homeXG: 1.62, awayXG: 1.48, label: "Goal" },
    { minute: 88, homeXG: 1.65, awayXG: 1.52 },
    { minute: 90, homeXG: 1.68, awayXG: 1.55 },
  ];
}

// ── Momentum data ───────────────────────────────────────────────────

function deriveMomentumFromXG(xgData: XGDataPoint[]): Array<{ minute: number; value: number }> {
  return xgData.map((d) => ({
    minute: d.minute,
    value: d.homeXG - d.awayXG, // positive = home dominant, negative = away dominant
  }));
}

// ── Event icon + color mapping ──────────────────────────────────────

const EVENT_CONFIG: Record<
  MatchEventType,
  {
    icon: typeof CircleDot;
    color: string;
    bgColor: string;
    label: { zh: string; en: string };
  }
> = {
  goal: {
    icon: CircleDot,
    color: "text-[var(--accent-green)]",
    bgColor: "bg-[var(--accent-green)]/20",
    label: { zh: "进球", en: "Goal" },
  },
  own_goal: {
    icon: CircleDot,
    color: "text-[var(--accent-red)]",
    bgColor: "bg-[var(--accent-red)]/20",
    label: { zh: "乌龙球", en: "Own Goal" },
  },
  penalty_scored: {
    icon: Target,
    color: "text-[var(--accent-green)]",
    bgColor: "bg-[var(--accent-green)]/20",
    label: { zh: "点球进", en: "Penalty Scored" },
  },
  penalty_missed: {
    icon: Target,
    color: "text-[var(--accent-red)]",
    bgColor: "bg-[var(--accent-red)]/20",
    label: { zh: "点球未进", en: "Penalty Missed" },
  },
  yellow_card: {
    icon: Square,
    color: "text-[var(--accent-amber)]",
    bgColor: "bg-[var(--accent-amber)]/20",
    label: { zh: "黄牌", en: "Yellow Card" },
  },
  red_card: {
    icon: Square,
    color: "text-[var(--accent-red)]",
    bgColor: "bg-[var(--accent-red)]/20",
    label: { zh: "红牌", en: "Red Card" },
  },
  second_yellow: {
    icon: Square,
    color: "text-[var(--accent-red)]",
    bgColor: "bg-[var(--accent-red)]/20",
    label: { zh: "两黄变红", en: "Second Yellow" },
  },
  substitution: {
    icon: ArrowUpDown,
    color: "text-[var(--accent-blue)]",
    bgColor: "bg-[var(--accent-blue)]/20",
    label: { zh: "换人", en: "Substitution" },
  },
  var_decision: {
    icon: Monitor,
    color: "text-[var(--accent-purple)]",
    bgColor: "bg-[var(--accent-purple)]/20",
    label: { zh: "VAR", en: "VAR" },
  },
  kick_off: {
    icon: Zap,
    color: "text-[var(--text-muted)]",
    bgColor: "bg-[var(--text-muted)]/10",
    label: { zh: "开球", en: "Kick Off" },
  },
  half_time: {
    icon: Minus,
    color: "text-[var(--text-muted)]",
    bgColor: "bg-[var(--text-muted)]/10",
    label: { zh: "半场", en: "Half Time" },
  },
  full_time: {
    icon: Flag,
    color: "text-[var(--text-muted)]",
    bgColor: "bg-[var(--text-muted)]/10",
    label: { zh: "全场", en: "Full Time" },
  },
  extra_time: {
    icon: Clock,
    color: "text-[var(--text-muted)]",
    bgColor: "bg-[var(--text-muted)]/10",
    label: { zh: "加时", en: "Extra Time" },
  },
  corner: {
    icon: CornerUpRight,
    color: "text-[var(--text-secondary)]",
    bgColor: "bg-[var(--text-secondary)]/10",
    label: { zh: "角球", en: "Corner" },
  },
};

// ── Sub-components ──────────────────────────────────────────────────

function formatMinute(minute: number, addedTime?: number): string {
  if (addedTime && addedTime > 0) return `${minute}+${addedTime}'`;
  return `${minute}'`;
}

function EventIcon({ type }: { type: MatchEventType }) {
  const config = EVENT_CONFIG[type];
  const Icon = config.icon;

  if (type === "yellow_card") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-yellow-400">
        <Square className="h-3.5 w-3.5 text-yellow-900" fill="currentColor" />
      </div>
    );
  }
  if (type === "red_card" || type === "second_yellow") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded bg-red-500">
        <Square className="h-3.5 w-3.5 text-red-100" fill="currentColor" />
      </div>
    );
  }
  if (type === "goal" || type === "own_goal" || type === "penalty_scored") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-green)]/20">
        <CircleDot className="h-4 w-4 text-[var(--accent-green)]" />
      </div>
    );
  }

  return (
    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${config.bgColor}`}>
      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
    </div>
  );
}

function TimelineEvent({
  event,
  homeTeam,
  awayTeam,
  lang,
  index,
}: {
  event: MatchEvent;
  homeTeam: string;
  awayTeam: string;
  lang: "zh" | "en";
  index: number;
}) {
  const config = EVENT_CONFIG[event.type];
  const isHome = event.side === "home";
  const isAway = event.side === "away";
  const isNeutral = event.side === "neutral";
  const isKey =
    event.type === "goal" ||
    event.type === "own_goal" ||
    event.type === "penalty_scored" ||
    event.type === "red_card" ||
    event.type === "second_yellow";

  const sideLabel = isHome ? homeTeam : isAway ? awayTeam : "";

  return (
    <motion.div
      initial={{ opacity: 0, x: isHome ? -12 : isAway ? 12 : 0, y: isNeutral ? 8 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`relative flex items-start gap-3 ${
        isKey ? "py-3" : "py-1.5"
      }`}
    >
      {/* Time badge */}
      <div className="flex w-12 flex-shrink-0 items-center justify-end">
        <span
          className={`font-mono text-xs tabular-nums ${
            isKey ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-muted)]"
          }`}
        >
          {formatMinute(event.minute, event.addedTime)}
        </span>
      </div>

      {/* Timeline dot + line */}
      <div className="relative flex flex-col items-center">
        <EventIcon type={event.type} />
      </div>

      {/* Content */}
      <div className={`min-w-0 flex-1 ${isKey ? "pb-1" : ""}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${config.color}`}>
                {config.label[lang]}
              </span>
              {!isNeutral && (
                <span
                  className={`badge text-[10px] ${
                    isHome ? "badge-green" : "badge-blue"
                  }`}
                >
                  {sideLabel}
                </span>
              )}
            </div>
            {event.player && (
              <div className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">
                {event.player}
                {event.assistPlayer && (
                  <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                    ({lang === "zh" ? "助攻" : "ast"}: {event.assistPlayer})
                  </span>
                )}
              </div>
            )}
            {event.detail && (
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                {event.detail}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function XGTimelineChart({
  data,
  homeTeam,
  awayTeam,
  lang,
}: {
  data: XGDataPoint[];
  homeTeam: string;
  awayTeam: string;
  lang: "zh" | "en";
}) {
  const goalEvents = data.filter((d) => d.label === "Goal");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <TrendingUp className="h-4 w-4 text-[var(--accent-purple)]" />
        {lang === "zh" ? "xG 时间线" : "xG Timeline"}
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="xgHome" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="xgAway" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-color)"
              vertical={false}
            />
            <XAxis
              dataKey="minute"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={{ stroke: "var(--border-color)" }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "var(--text-primary)",
              }}
              formatter={(value: number, name: string) => [
                value.toFixed(2),
                name === "homeXG" ? homeTeam : awayTeam,
              ]}
              labelFormatter={(label) => `${label}'`}
            />
            <Area
              type="monotone"
              dataKey="homeXG"
              stroke="var(--accent-green)"
              strokeWidth={2}
              fill="url(#xgHome)"
              name="homeXG"
              dot={false}
              activeDot={{ r: 4, fill: "var(--accent-green)" }}
            />
            <Area
              type="monotone"
              dataKey="awayXG"
              stroke="var(--accent-blue)"
              strokeWidth={2}
              fill="url(#xgAway)"
              name="awayXG"
              dot={false}
              activeDot={{ r: 4, fill: "var(--accent-blue)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-[var(--accent-green)]" />
          <span className="text-[var(--text-secondary)]">{homeTeam}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-[var(--accent-blue)]" />
          <span className="text-[var(--text-secondary)]">{awayTeam}</span>
        </div>
      </div>
    </div>
  );
}

function MomentumIndicator({
  data,
  homeTeam,
  awayTeam,
  lang,
}: {
  data: Array<{ minute: number; value: number }>;
  homeTeam: string;
  awayTeam: string;
  lang: "zh" | "en";
}) {
  // Compute momentum segments
  const segments = useMemo(() => {
    if (data.length < 2) return [];
    const result: Array<{
      start: number;
      end: number;
      dominant: "home" | "away" | "neutral";
      intensity: number;
    }> = [];

    for (let i = 0; i < data.length - 1; i++) {
      const val = data[i].value;
      const absVal = Math.abs(val);
      const dominant = val > 0.1 ? "home" : val < -0.1 ? "away" : "neutral";
      result.push({
        start: data[i].minute,
        end: data[i + 1].minute,
        dominant,
        intensity: Math.min(1, absVal / 0.8),
      });
    }
    return result;
  }, [data]);

  // Calculate overall momentum
  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const overallDominant =
    latestValue > 0.1 ? "home" : latestValue < -0.1 ? "away" : "neutral";

  // Count momentum phases
  const homePhases = segments.filter((s) => s.dominant === "home").length;
  const awayPhases = segments.filter((s) => s.dominant === "away").length;
  const totalPhases = segments.length || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Activity className="h-4 w-4 text-[var(--accent-amber)]" />
        {lang === "zh" ? "比赛动量" : "Match Momentum"}
      </div>

      {/* Momentum bar visualization */}
      <div className="space-y-2">
        {/* Labels */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--accent-green)] font-medium">{homeTeam}</span>
          <span className="text-[var(--text-muted)]">
            {lang === "zh" ? "中立" : "Neutral"}
          </span>
          <span className="text-[var(--accent-blue)] font-medium">{awayTeam}</span>
        </div>

        {/* Segmented bar */}
        <div className="relative h-8 overflow-hidden rounded-full bg-[var(--bg-primary)]">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 h-full w-px bg-[var(--border-color)]" />

          {/* Momentum segments */}
          <div className="flex h-full">
            {segments.map((seg, i) => {
              const widthPct = ((seg.end - seg.start) / 90) * 100;
              const color =
                seg.dominant === "home"
                  ? `rgba(16, 185, 129, ${0.15 + seg.intensity * 0.55})`
                  : seg.dominant === "away"
                    ? `rgba(59, 130, 246, ${0.15 + seg.intensity * 0.55})`
                    : "var(--bg-card)";
              return (
                <div
                  key={i}
                  style={{ width: `${widthPct}%`, backgroundColor: color }}
                  className="h-full transition-colors"
                  title={`${seg.start}'-${seg.end}': ${
                    seg.dominant === "home"
                      ? homeTeam
                      : seg.dominant === "away"
                        ? awayTeam
                        : lang === "zh"
                          ? "均势"
                          : "Even"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Minute markers */}
        <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>0&apos;</span>
          <span>15&apos;</span>
          <span>30&apos;</span>
          <span>HT</span>
          <span>60&apos;</span>
          <span>75&apos;</span>
          <span>FT</span>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-[var(--bg-primary)] p-2 text-center">
          <div className="text-lg font-bold tabular-nums text-[var(--accent-green)]">
            {Math.round((homePhases / totalPhases) * 100)}%
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {lang === "zh" ? "主队控制" : "Home Control"}
          </div>
        </div>
        <div className="rounded-lg bg-[var(--bg-primary)] p-2 text-center">
          <div className="text-xs font-medium text-[var(--text-muted)]">
            {overallDominant === "home"
              ? homeTeam
              : overallDominant === "away"
                ? awayTeam
                : lang === "zh"
                  ? "均势"
                  : "Even"}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {lang === "zh" ? "当前主导" : "Dominant"}
          </div>
        </div>
        <div className="rounded-lg bg-[var(--bg-primary)] p-2 text-center">
          <div className="text-lg font-bold tabular-nums text-[var(--accent-blue)]">
            {Math.round((awayPhases / totalPhases) * 100)}%
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            {lang === "zh" ? "客队控制" : "Away Control"}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchScoreHeader({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  events,
  lang,
}: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  lang: "zh" | "en";
}) {
  const homeGoals = events.filter(
    (e) => (e.type === "goal" || e.type === "penalty_scored") && e.side === "home",
  );
  const awayGoals = events.filter(
    (e) => (e.type === "goal" || e.type === "penalty_scored") && e.side === "away",
  );
  const homeYellow = events.filter((e) => e.type === "yellow_card" && e.side === "home").length;
  const awayYellow = events.filter((e) => e.type === "yellow_card" && e.side === "away").length;
  const homeRed = events.filter(
    (e) => (e.type === "red_card" || e.type === "second_yellow") && e.side === "home",
  ).length;
  const awayRed = events.filter(
    (e) => (e.type === "red_card" || e.type === "second_yellow") && e.side === "away",
  ).length;
  const homeCorners = events.filter((e) => e.type === "corner" && e.side === "home").length;
  const awayCorners = events.filter((e) => e.type === "corner" && e.side === "away").length;

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
      {/* Score */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex-1 text-right">
          <div className="text-sm font-medium text-[var(--text-primary)]">{homeTeam}</div>
          {homeGoals.map((g) => (
            <div key={g.id} className="text-[10px] text-[var(--text-muted)]">
              {g.player} {formatMinute(g.minute, g.addedTime)}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold tabular-nums text-[var(--accent-green)]">
            {homeScore}
          </span>
          <span className="text-lg text-[var(--text-muted)]">-</span>
          <span className="text-3xl font-bold tabular-nums text-[var(--accent-blue)]">
            {awayScore}
          </span>
        </div>

        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-[var(--text-primary)]">{awayTeam}</div>
          {awayGoals.map((g) => (
            <div key={g.id} className="text-[10px] text-[var(--text-muted)]">
              {formatMinute(g.minute, g.addedTime)} {g.player}
            </div>
          ))}
        </div>
      </div>

      {/* Match stats bar */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="flex items-center justify-center gap-1">
          <Square className="h-3 w-3 text-yellow-400" fill="currentColor" />
          <span className="tabular-nums">{homeYellow}</span>
        </div>
        <div className="text-[var(--text-muted)]">
          {lang === "zh" ? "黄牌" : "Yellow"}
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="tabular-nums">{awayYellow}</span>
          <Square className="h-3 w-3 text-yellow-400" fill="currentColor" />
        </div>

        <div className="flex items-center justify-center gap-1">
          <Square className="h-3 w-3 text-red-500" fill="currentColor" />
          <span className="tabular-nums">{homeRed}</span>
        </div>
        <div className="text-[var(--text-muted)]">
          {lang === "zh" ? "红牌" : "Red"}
        </div>
        <div className="flex items-center justify-center gap-1">
          <span className="tabular-nums">{awayRed}</span>
          <Square className="h-3 w-3 text-red-500" fill="currentColor" />
        </div>

        <div className="tabular-nums">{homeCorners}</div>
        <div className="text-[var(--text-muted)]">
          {lang === "zh" ? "角球" : "Corners"}
        </div>
        <div className="tabular-nums">{awayCorners}</div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────

export function MatchTimeline({
  homeTeam,
  awayTeam,
  homeScore = 2,
  awayScore = 2,
  events: providedEvents,
  xgData: providedXG,
  lang = "zh",
}: MatchTimelineProps) {
  const [showMinorEvents, setShowMinorEvents] = useState(false);

  const events = useMemo(
    () => providedEvents ?? generateDemoEvents(homeTeam, awayTeam),
    [providedEvents, homeTeam, awayTeam],
  );

  const xgData = useMemo(
    () => providedXG ?? generateDemoXG(),
    [providedXG],
  );

  const momentum = useMemo(() => deriveMomentumFromXG(xgData), [xgData]);

  // Filter events for display
  const keyEventTypes: MatchEventType[] = [
    "goal",
    "own_goal",
    "penalty_scored",
    "penalty_missed",
    "yellow_card",
    "red_card",
    "second_yellow",
    "substitution",
    "var_decision",
    "half_time",
    "full_time",
    "kick_off",
  ];

  const filteredEvents = useMemo(() => {
    if (showMinorEvents) return events;
    return events.filter(
      (e) =>
        keyEventTypes.includes(e.type) ||
        (e.type === "kick_off" && e.minute === 0) ||
        e.type === "half_time" ||
        e.type === "full_time",
    );
  }, [events, showMinorEvents]);

  const halfTimeIndex = filteredEvents.findIndex((e) => e.type === "half_time");

  return (
    <div className="space-y-4">
      {/* Score header */}
      <MatchScoreHeader
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        homeScore={homeScore}
        awayScore={awayScore}
        events={events}
        lang={lang}
      />

      {/* Charts section */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* xG Timeline */}
        <div className="card">
          <XGTimelineChart
            data={xgData}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            lang={lang}
          />
        </div>

        {/* Momentum */}
        <div className="card">
          <MomentumIndicator
            data={momentum}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            lang={lang}
          />
        </div>
      </div>

      {/* Event timeline */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-[var(--accent-blue)]" />
            {lang === "zh" ? "比赛事件" : "Match Events"}
          </div>
          <button
            onClick={() => setShowMinorEvents(!showMinorEvents)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
              showMinorEvents
                ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {showMinorEvents ? (
              <>
                <Eye className="h-3 w-3" />
                {lang === "zh" ? "全部事件" : "All Events"}
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                {lang === "zh" ? "关键事件" : "Key Events"}
              </>
            )}
          </button>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[60px] top-0 bottom-0 w-px bg-[var(--border-color)]" />

          {/* First half */}
          <div className="space-y-0">
            {filteredEvents
              .filter((e) => e.minute <= 45 || e.type === "half_time")
              .map((event, i) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  lang={lang}
                  index={i}
                />
              ))}
          </div>

          {/* Half time divider */}
          {halfTimeIndex >= 0 && (
            <div className="relative flex items-center gap-3 py-3">
              <div className="w-12" />
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-primary)]">
                <Minus className="h-3 w-3 text-[var(--text-muted)]" />
              </div>
              <div className="flex-1 border-t border-dashed border-[var(--border-color)]" />
              <span className="text-xs text-[var(--text-muted)] pr-4">
                {lang === "zh" ? "半场休息" : "Half Time"}
              </span>
            </div>
          )}

          {/* Second half */}
          <div className="space-y-0">
            {filteredEvents
              .filter((e) => e.minute > 45 && e.type !== "half_time")
              .map((event, i) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  homeTeam={homeTeam}
                  awayTeam={awayTeam}
                  lang={lang}
                  index={i}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
