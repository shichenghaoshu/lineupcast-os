"use client";

import { TopBar } from "@/components/TopBar";
import { MatchHeader } from "@/components/MatchHeader";
import { MetricCard } from "@/components/MetricCard";
import { PredictionCard } from "@/components/PredictionCard";
import { FormationPitch } from "@/components/FormationPitch";
import { PlayerCard } from "@/components/PlayerCard";
import {
  currentMatch,
  manchesterRedXI,
  matchPrediction,
  trendData,
} from "@/lib/mock-data";
import {
  Users,
  FileText,
  Target,
  Monitor,
  TrendingUp,
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
  return (
    <div className="min-h-screen">
      <TopBar title="数据驾驶舱" subtitle="Manchester Red vs Shanghai Harbor" />

      <div className="space-y-4 p-6">
        {/* Match Header */}
        <MatchHeader match={currentMatch} />

        {/* KPI Cards */}
        <div className="grid grid-cols-5 gap-3">
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
            value="72"
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
        <div className="grid grid-cols-12 gap-4">
          {/* Left: Formation + AI Summary */}
          <div className="col-span-4 space-y-4">
            <div className="card">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                阵容预览 · 4-2-3-1
              </div>
              <FormationPitch players={manchesterRedXI} />
            </div>

            <div className="card space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                AI 赛前摘要
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                Manchester Red 近期状态出色，连续3场取胜。V. Finish 以1.8 xG领跑锋线，
                J. Spark 边路突破能力将成为撕裂对手防线的关键。需注意 C. Press 的犯规频率（2.1/90分钟），
                黄牌风险42%。Dixon-Coles模型预测主队胜率48%，阵容调整后置信度提升至72%。
              </p>
            </div>
          </div>

          {/* Center: Prediction + Trend */}
          <div className="col-span-5 space-y-4">
            <PredictionCard
              homeWin={matchPrediction.homeWin}
              draw={matchPrediction.draw}
              awayWin={matchPrediction.awayWin}
              homeTeam="Manchester Red"
              awayTeam="Shanghai Harbor"
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
                  {matchPrediction.expectedHomeGoals}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Manchester Red</div>
              </div>
              <div className="card text-center">
                <div className="text-xs text-[var(--text-muted)]">预期进球</div>
                <div className="text-2xl font-bold text-[var(--accent-blue)]">
                  {matchPrediction.expectedAwayGoals}
                </div>
                <div className="text-xs text-[var(--text-muted)]">Shanghai Harbor</div>
              </div>
            </div>
          </div>

          {/* Right: Key Players */}
          <div className="col-span-3 space-y-4">
            <div className="card">
              <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                关键球员
              </div>
              <div className="space-y-2">
                {manchesterRedXI
                  .sort((a, b) => b.recentRating - a.recentRating)
                  .slice(0, 5)
                  .map((player) => (
                    <PlayerCard key={player.id} player={player} compact />
                  ))}
              </div>
            </div>

            <div className="card space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                可能进球人
              </div>
              {matchPrediction.possibleScorers.map((scorer) => (
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
            </div>

            <div className="card space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                黄牌风险
              </div>
              {matchPrediction.yellowCardRisks.map((risk) => (
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
