"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { MatchHeader } from "@/components/MatchHeader";
import { MetricCard } from "@/components/MetricCard";
import { PredictionCard } from "@/components/PredictionCard";
import { FormationPitch } from "@/components/FormationPitch";
import { PlayerCard } from "@/components/PlayerCard";
import { H2HExplorer } from "@/components/H2HExplorer";
import { FormTracker } from "@/components/FormTracker";
import { DemoBadge } from "@/components/DemoBadge";
import { loadMatch, loadPrediction, loadLineups } from "@/lib/data-loader";
import {
  manchesterRedXI,
  trendData,
  h2hRecord,
  homeForm,
} from "@/lib/mock-data";
import type { Match, Prediction, Player } from "@/lib/types";
import {
  Users,
  FileText,
  Target,
  Monitor,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [players, setPlayers] = useState<Player[]>(manchesterRedXI);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      const [m, p, l] = await Promise.all([
        loadMatch(),
        loadPrediction("match-001"),
        loadLineups("match-001"),
      ]);
      if (cancelled) return;

      setMatch(m.data);
      setPrediction(p.data);
      setPlayers(l.data);
      setIsDemo(m.isDemo || p.isDemo || l.isDemo);
      setLoading(false);
    }

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !match || !prediction) {
    return (
      <div className="min-h-screen">
        {/* TopBar skeleton */}
        <div className="flex h-14 items-center border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 md:px-6">
          <div className="pl-12 md:pl-0 space-y-1">
            <div className="h-4 w-32 rounded bg-[var(--bg-card)] animate-pulse" />
            <div className="h-3 w-48 rounded bg-[var(--bg-card)] animate-pulse" />
          </div>
        </div>

        <div className="space-y-4 p-4 md:p-6">
          {/* Match header skeleton */}
          <div className="card flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-center space-y-1">
                <div className="h-6 w-32 rounded bg-[var(--bg-primary)] animate-pulse" />
                <div className="h-3 w-10 rounded bg-[var(--bg-primary)] animate-pulse mx-auto" />
              </div>
              <div className="h-4 w-8 rounded bg-[var(--bg-primary)] animate-pulse" />
              <div className="text-center space-y-1">
                <div className="h-6 w-32 rounded bg-[var(--bg-primary)] animate-pulse" />
                <div className="h-3 w-10 rounded bg-[var(--bg-primary)] animate-pulse mx-auto" />
              </div>
            </div>
          </div>

          {/* KPI cards skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-[var(--bg-primary)] animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-3 w-20 rounded bg-[var(--bg-primary)] animate-pulse" />
                  <div className="h-6 w-12 rounded bg-[var(--bg-primary)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>

          {/* Main grid skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 space-y-4">
              <div className="card h-64 rounded-lg bg-[var(--bg-card)] animate-pulse" />
              <div className="card h-24 rounded-lg bg-[var(--bg-card)] animate-pulse" />
            </div>
            <div className="lg:col-span-5 space-y-4">
              <div className="card h-32 rounded-lg bg-[var(--bg-card)] animate-pulse" />
              <div className="card h-48 rounded-lg bg-[var(--bg-card)] animate-pulse" />
            </div>
            <div className="lg:col-span-3 space-y-4">
              <div className="card h-48 rounded-lg bg-[var(--bg-card)] animate-pulse" />
              <div className="card h-32 rounded-lg bg-[var(--bg-card)] animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between">
        <TopBar
          title="数据驾驶舱"
          subtitle={`${match.homeTeam} vs ${match.awayTeam}`}
        />
        {isDemo && (
          <div className="fixed right-4 top-3 z-50">
            <DemoBadge />
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 md:p-6">
        {/* Match Header */}
        <MatchHeader match={match} />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Lineup Integrity / 阵容完整度"
            value="86"
            icon={<Users className="h-4 w-4" />}
            color="blue"
          />
          <MetricCard
            label="口播稿就绪"
            value="91"
            icon={<FileText className="h-4 w-4" />}
            color="green"
            subtitle="91% 完成"
          />
          <MetricCard
            label="Prediction Confidence / 预测置信度"
            value={String(prediction.confidence)}
            icon={<Target className="h-4 w-4" />}
            color="purple"
            subtitle="%"
          />
          <MetricCard
            label="OBS 状态"
            value="Ready"
            icon={<Monitor className="h-4 w-4" />}
            color="green"
          />
          <MetricCard
            label="趋势"
            value="↑ 3连胜"
            icon={<TrendingUp className="h-4 w-4" />}
            color="amber"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Formation + AI Summary */}
          <div className="lg:col-span-4 space-y-4">
            <div className="card">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                阵容预览 · 4-2-3-1
              </div>
              <FormationPitch players={players} />
            </div>

            <div className="card space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                AI 赛前摘要
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {match.homeTeam} 近期状态出色，连续3场取胜。V. Finish 以1.8 xG领跑锋线，
                J. Spark 边路突破能力将成为撕裂对手防线的关键。需注意 C. Press 的犯规频率（2.1/90分钟），
                黄牌风险42%。Dixon-Coles模型预测主队胜率{prediction.homeWin}%，阵容调整后置信度提升至{prediction.confidence}%。
              </p>
            </div>

            <H2HExplorer
              record={h2hRecord}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
            />
          </div>

          {/* Center: Prediction + Trend */}
          <div className="lg:col-span-5 space-y-4">
            <PredictionCard
              homeWin={prediction.homeWin}
              draw={prediction.draw}
              awayWin={prediction.awayWin}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
            />
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Prediction Summary / 预测摘要
            </div>

            <div className="card">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                近5场趋势
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={trendData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="match"
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                    domain={[6, 8]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rating"
                    stroke="var(--accent-blue)"
                    strokeWidth={2}
                    dot={{ fill: "var(--accent-blue)", r: 4 }}
                    name="评分"
                  />
                  <Line
                    type="monotone"
                    dataKey="xG"
                    stroke="var(--accent-green)"
                    strokeWidth={2}
                    dot={{ fill: "var(--accent-green)", r: 4 }}
                    name="xG"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Expected Goals */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card text-center">
                <div className="text-xs text-[var(--text-muted)]">预期进球</div>
                <div className="text-2xl font-bold text-[var(--accent-green)]">
                  {prediction.expectedHomeGoals}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {match.homeTeam}
                </div>
              </div>
              <div className="card text-center">
                <div className="text-xs text-[var(--text-muted)]">预期进球</div>
                <div className="text-2xl font-bold text-[var(--accent-blue)]">
                  {prediction.expectedAwayGoals}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  {match.awayTeam}
                </div>
              </div>
            </div>

            <FormTracker form={homeForm} teamName={match.homeTeam} />
          </div>

          {/* Right: Key Players */}
          <div className="lg:col-span-3 space-y-4">
            <Card hoverShadow="amber">
              <Card.Header>关键球员</Card.Header>
              <Card.Body>
                <div className="space-y-2">
                  {players
                    .sort((a, b) => b.recentRating - a.recentRating)
                    .slice(0, 5)
                    .map((player) => (
                      <PlayerCard key={player.id} player={player} compact />
                    ))}
                </div>
              </Card.Body>
            </Card>

            <Card hoverShadow="green" className="space-y-2">
              <Card.Header>可能进球人</Card.Header>
              <Card.Body>
              {prediction.possibleScorers.map((scorer) => (
                <div
                  key={scorer.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{scorer.name}</span>
                  <span className="tabular-nums text-[var(--accent-green)]">
                    {scorer.probability}%
                  </span>
                </div>
              ))}
              </Card.Body>
            </Card>

            <Card hoverShadow="amber" className="space-y-2">
              <Card.Header>黄牌风险</Card.Header>
              <Card.Body>
              {prediction.yellowCardRisks.map((risk) => (
                <div
                  key={risk.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span>{risk.name}</span>
                  <span className="tabular-nums text-[var(--accent-amber)]">
                    {risk.risk}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
