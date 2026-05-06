"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { manchesterRedXI } from "@/lib/mock-data";
import { getDemoMatch, getPrediction, type ApiPrediction } from "@/lib/api-client";
import {
  Star,
  Target,
  Crosshair,
  AlertTriangle,
  TrendingUp,
  Shield,
  Zap,
  MessageSquare,
} from "lucide-react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function PlayerPage() {
  const params = useParams();
  const player = manchesterRedXI.find((p) => p.id === params.id);
  const [prediction, setPrediction] = useState<ApiPrediction | null>(null);

  useEffect(() => {
    let active = true;
    getDemoMatch()
      .then((match) => getPrediction(match.matchId))
      .then((next) => {
        if (active) setPrediction(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!player) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-muted)]">球员未找到</p>
      </div>
    );
  }

  const radarData = [
    { stat: "进攻", value: player.vaepAttack * 100, fullMark: 100 },
    { stat: "防守", value: player.vaepDefense * 100, fullMark: 100 },
    { stat: "评分", value: player.recentRating * 12, fullMark: 100 },
    { stat: "xG", value: Math.min(player.xGLast5 * 40, 100), fullMark: 100 },
    { stat: "射门", value: Math.min(player.shotsLast5 * 6, 100), fullMark: 100 },
    { stat: "助攻", value: Math.min(player.assistsLast5 * 20, 100), fullMark: 100 },
  ];

  const recentStats = [
    { match: "MD28", rating: player.recentRating - 0.3, xG: player.xGLast5 * 0.8 },
    { match: "MD29", rating: player.recentRating - 0.5, xG: player.xGLast5 * 0.6 },
    { match: "MD30", rating: player.recentRating + 0.2, xG: player.xGLast5 * 1.2 },
    { match: "MD31", rating: player.recentRating - 0.1, xG: player.xGLast5 * 0.9 },
    { match: "MD32", rating: player.recentRating, xG: player.xGLast5 },
  ];

  const predictionRanks = useMemo(() => {
    if (!prediction || !player) return null;
    const scorerIndex = prediction.goalScorers.findIndex((item) => item.player === player.name);
    const cardIndex = prediction.cardRisks.findIndex((item) => item.player === player.name);
    return {
      scorer:
        scorerIndex >= 0
          ? { rank: scorerIndex + 1, ...prediction.goalScorers[scorerIndex] }
          : null,
      card:
        cardIndex >= 0
          ? { rank: cardIndex + 1, ...prediction.cardRisks[cardIndex] }
          : null,
    };
  }, [prediction, player]);

  return (
    <div className="min-h-screen">
      <TopBar title={player.name} subtitle={`${player.position} · #${player.number}`} />

      <div className="space-y-4 p-6">
        {/* Header card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[var(--accent-blue)]/20 text-3xl font-bold text-[var(--accent-blue)]">
                {player.number}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{player.name}</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {player.role} · {player.age}岁 · {player.nationality}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-6 w-6 text-[var(--accent-amber)]" />
              <span className="text-3xl font-bold tabular-nums">
                {player.recentRating.toFixed(1)}
              </span>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-12 gap-4">
          {/* Left: Radar + Stats */}
          <div className="col-span-5 space-y-4">
            <div className="card">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                VAEP 能力雷达图
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border-color)" />
                  <PolarAngleAxis
                    dataKey="stat"
                    tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={false}
                    axisLine={false}
                  />
                  <Radar
                    dataKey="value"
                    stroke="var(--accent-blue)"
                    fill="var(--accent-blue)"
                    fillOpacity={0.2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                近5场数据趋势
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={recentStats}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="match"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="rating"
                    fill="var(--accent-blue)"
                    radius={[4, 4, 0, 0]}
                    name="评分"
                  />
                  <Bar
                    dataKey="xG"
                    fill="var(--accent-green)"
                    radius={[4, 4, 0, 0]}
                    name="xG"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Details */}
          <div className="col-span-7 space-y-4">
            {/* Key player question */}
            <div className="card space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4 text-[var(--accent-amber)]" />
                为什么他是关键球员？
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {player.commentaryNote}
              </p>
            </div>

            {/* Prediction evidence */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PredictionEvidence
                title="进球排名"
                empty="未进入本场进球候选榜"
                value={
                  predictionRanks?.scorer
                    ? `#${predictionRanks.scorer.rank} · ${predictionRanks.scorer.probability}%`
                    : null
                }
                color="var(--accent-green)"
                evidence={predictionRanks?.scorer?.evidence ?? []}
              />
              <PredictionEvidence
                title="牌风险排名"
                empty="未进入本场牌风险榜"
                value={
                  predictionRanks?.card
                    ? `#${predictionRanks.card.rank} · 黄牌 ${predictionRanks.card.yellowRisk}%`
                    : null
                }
                color="var(--accent-amber)"
                evidence={predictionRanks?.card?.evidence ?? []}
              />
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "xG / 5场", value: player.xGLast5.toFixed(1), icon: Target, color: "green" },
                { label: "射门 / 5场", value: player.shotsLast5, icon: Crosshair, color: "blue" },
                { label: "助攻 / 5场", value: player.assistsLast5, icon: TrendingUp, color: "purple" },
                { label: "犯规 / 90", value: player.foulsPer90.toFixed(1), icon: AlertTriangle, color: "amber" },
                { label: "黄牌 / 10场", value: player.yellowCardsLast10, icon: AlertTriangle, color: "amber" },
                { label: "红牌 / 10场", value: player.redCardsLast10, icon: Shield, color: "red" },
              ].map((stat) => (
                <div key={stat.label} className="card-hover text-center">
                  <stat.icon className={`mx-auto h-4 w-4 text-[var(--accent-${stat.color})]`} />
                  <div className="mt-1 text-xs text-[var(--text-muted)]">{stat.label}</div>
                  <div className="text-lg font-bold tabular-nums">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* VAEP bars */}
            <div className="card space-y-3">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                VAEP 贡献
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-[var(--accent-green)]">
                    <Target className="h-3 w-3" /> 进攻 VAEP
                  </span>
                  <span className="tabular-nums">{player.vaepAttack.toFixed(2)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${player.vaepAttack * 100}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full bg-[var(--accent-green)]"
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 text-[var(--accent-blue)]">
                    <Shield className="h-3 w-3" /> 防守 VAEP
                  </span>
                  <span className="tabular-nums">{player.vaepDefense.toFixed(2)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${player.vaepDefense * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="h-full rounded-full bg-[var(--accent-blue)]"
                  />
                </div>
              </div>
            </div>

            {/* Possible goals / discipline */}
            <div className="grid grid-cols-2 gap-3">
              {player.xGLast5 > 0.5 && (
                <div className="card space-y-1">
                  <div className="flex items-center gap-1 text-xs font-medium text-[var(--accent-green)]">
                    <Target className="h-3 w-3" />
                    可能进球原因
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    近5场xG {player.xGLast5.toFixed(1)}，射门{player.shotsLast5}次，
                    门前把握机会能力强。
                  </p>
                </div>
              )}
              <div className="card space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-[var(--accent-amber)]">
                  <AlertTriangle className="h-3 w-3" />
                  纪律风险原因
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  每90分钟犯规{player.foulsPer90.toFixed(1)}次，
                  近10场黄牌{player.yellowCardsLast10}张，模型认为当前纪律风险
                  {player.foulsPer90 > 1.0 ? "偏高，需要控制对抗尺度。" : "较低，但仍需避免无谓犯规。"}
                </p>
              </div>
            </div>

            {/* AI Commentary Note */}
            <div className="card space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-purple)]">
                <MessageSquare className="h-3.5 w-3.5" />
                AI 口播备注（可朗读）
              </div>
              <div className="rounded bg-[var(--bg-primary)] p-3 font-mono text-sm leading-relaxed text-[var(--text-secondary)]">
                {player.commentaryNote}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PredictionEvidence({
  title,
  value,
  empty,
  color,
  evidence,
}: {
  title: string;
  value: string | null;
  empty: string;
  color: string;
  evidence: string[];
}) {
  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </div>
        {value && (
          <span className="text-sm font-bold tabular-nums" style={{ color }}>
            {value}
          </span>
        )}
      </div>
      {value ? (
        <div className="space-y-1 text-xs leading-relaxed text-[var(--text-muted)]">
          {evidence.slice(0, 2).map((item) => (
            <p key={item} className="line-clamp-2">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">{empty}</p>
      )}
    </div>
  );
}
