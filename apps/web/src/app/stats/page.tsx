"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import {
  matchStatsHistory,
  playerRadarData,
  teamComparisonData,
  teamComparisonRadar,
  historicalTrendData,
  manchesterRedXI,
  currentMatch,
} from "@/lib/mock-data";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Users,
  Swords,
  ChevronDown,
} from "lucide-react";

const COLORS = {
  blue: "var(--accent-blue)",
  green: "var(--accent-green)",
  purple: "var(--accent-purple)",
  amber: "var(--accent-amber)",
  red: "var(--accent-red)",
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-secondary)" },
};

type TabId = "match" | "player" | "comparison" | "history";

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "match", label: "比赛统计", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "player", label: "球员表现", icon: <Users className="h-4 w-4" /> },
  { id: "comparison", label: "球队对比", icon: <Swords className="h-4 w-4" /> },
  { id: "history", label: "历史趋势", icon: <TrendingUp className="h-4 w-4" /> },
];

/* ------------------------------------------------------------------ */
/*  Match Stats Charts (goals, xG, possession)                        */
/* ------------------------------------------------------------------ */

function MatchStatsSection() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Goals Bar Chart */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            近5场进球对比
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={matchStatsHistory} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="match" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }}
              />
              <Bar dataKey="homeGoals" name={`${currentMatch.homeTeam}`} fill={COLORS.blue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="awayGoals" name={`${currentMatch.awayTeam}`} fill={COLORS.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* xG Line Chart */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            期望进球 (xG) 趋势
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={matchStatsHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="match" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 3]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
              <Line
                type="monotone"
                dataKey="homeXG"
                name={`${currentMatch.homeTeam} xG`}
                stroke={COLORS.blue}
                strokeWidth={2}
                dot={{ fill: COLORS.blue, r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="awayXG"
                name={`${currentMatch.awayTeam} xG`}
                stroke={COLORS.green}
                strokeWidth={2}
                dot={{ fill: COLORS.green, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Possession Area Chart */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            控球率变化
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={matchStatsHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="match" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[30, 70]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
              <Area
                type="monotone"
                dataKey="homePossession"
                name={`${currentMatch.homeTeam}`}
                stroke={COLORS.blue}
                fill={COLORS.blue}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="awayPossession"
                name={`${currentMatch.awayTeam}`}
                stroke={COLORS.green}
                fill={COLORS.green}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Shots & Shots on Target */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            射门 & 射正统计
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={matchStatsHistory} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="match" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
              <Bar dataKey="homeShots" name={`${currentMatch.homeTeam} 射门`} fill={COLORS.blue} radius={[4, 4, 0, 0]} opacity={0.6} />
              <Bar dataKey="homeShotsOnTarget" name={`${currentMatch.homeTeam} 射正`} fill={COLORS.blue} radius={[4, 4, 0, 0]} />
              <Bar dataKey="awayShots" name={`${currentMatch.awayTeam} 射门`} fill={COLORS.green} radius={[4, 4, 0, 0]} opacity={0.6} />
              <Bar dataKey="awayShotsOnTarget" name={`${currentMatch.awayTeam} 射正`} fill={COLORS.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Player Performance Radar Charts                                   */
/* ------------------------------------------------------------------ */

function PlayerStatsSection() {
  const [selectedPlayer, setSelectedPlayer] = useState(playerRadarData[0].name);

  const player = playerRadarData.find((p) => p.name === selectedPlayer) ?? playerRadarData[0];
  const playerDetail = manchesterRedXI.find((p) => p.name === selectedPlayer);

  // Normalize radar data to 0-100 scale
  const radarData = [
    { stat: "进球", value: Math.round((player.goals / 10) * 100), fullMark: 100 },
    { stat: "助攻", value: Math.round((player.assists / 10) * 100), fullMark: 100 },
    { stat: "xG", value: Math.round((player.xG / 10) * 100), fullMark: 100 },
    { stat: "射门", value: Math.round((player.shots / 50) * 100), fullMark: 100 },
    { stat: "评分", value: Math.round((player.rating / 10) * 100), fullMark: 100 },
    { stat: "进攻VAEP", value: Math.round(player.vaepAttack * 100), fullMark: 100 },
  ];

  // Comparison bar data for all players
  const comparisonMetrics = [
    { key: "rating", label: "评分", max: 10 },
    { key: "xG", label: "xG", max: 10 },
    { key: "goals", label: "进球", max: 10 },
    { key: "assists", label: "助攻", max: 10 },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Player Selector */}
      <div className="card">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            选择球员
          </span>
          <div className="relative">
            <select
              value={selectedPlayer}
              onChange={(e) => setSelectedPlayer(e.target.value)}
              className="appearance-none rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 pr-8 text-sm text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
            >
              {playerRadarData.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          </div>
          {playerDetail && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="badge-blue">{playerDetail.position}</span>
              <span>{playerDetail.role}</span>
              <span>|</span>
              <span>{playerDetail.age}岁</span>
              <span>|</span>
              <span>{playerDetail.nationality}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Radar Chart */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            {selectedPlayer} - 能力雷达图
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="var(--border-color)" />
              <PolarAngleAxis
                dataKey="stat"
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={false}
              />
              <Radar
                name={selectedPlayer}
                dataKey="value"
                stroke={COLORS.blue}
                fill={COLORS.blue}
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip {...tooltipStyle} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Player Stats Detail */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            {selectedPlayer} - 详细数据
          </h3>
          <div className="space-y-3">
            {[
              { label: "近期评分", value: player.rating.toFixed(1), bar: player.rating / 10, color: COLORS.blue },
              { label: "xG (近5场)", value: player.xG.toFixed(1), bar: player.xG / 10, color: COLORS.green },
              { label: "进球 (近5场)", value: String(player.goals), bar: player.goals / 10, color: COLORS.purple },
              { label: "助攻 (近5场)", value: String(player.assists), bar: player.assists / 10, color: COLORS.amber },
              { label: "射门 (近5场)", value: String(player.shots), bar: player.shots / 50, color: COLORS.blue },
              { label: "进攻 VAEP", value: player.vaepAttack.toFixed(2), bar: player.vaepAttack, color: COLORS.green },
              { label: "防守 VAEP", value: player.vaepDefense.toFixed(2), bar: player.vaepDefense, color: COLORS.red },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
                  <span className="text-sm font-medium tabular-nums">{item.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-secondary)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(item.bar * 100, 100)}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {playerDetail?.commentaryNote && (
            <div className="mt-4 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3">
              <div className="text-xs text-[var(--text-muted)] mb-1">AI 球员评语</div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {playerDetail.commentaryNote}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* All Players Comparison */}
      <div className="card">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          关键球员对比
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="pb-2 text-left text-xs font-medium text-[var(--text-muted)]">球员</th>
                <th className="pb-2 text-center text-xs font-medium text-[var(--text-muted)]">位置</th>
                <th className="pb-2 text-center text-xs font-medium text-[var(--text-muted)]">评分</th>
                <th className="pb-2 text-center text-xs font-medium text-[var(--text-muted)]">xG</th>
                <th className="pb-2 text-center text-xs font-medium text-[var(--text-muted)]">进球</th>
                <th className="pb-2 text-center text-xs font-medium text-[var(--text-muted)]">助攻</th>
                <th className="pb-2 text-center text-xs font-medium text-[var(--text-muted)]">射门</th>
                <th className="pb-2 text-center text-xs font-medium text-[var(--text-muted)]">进攻VAEP</th>
              </tr>
            </thead>
            <tbody>
              {playerRadarData.map((p) => {
                const detail = manchesterRedXI.find((d) => d.name === p.name);
                return (
                  <tr
                    key={p.name}
                    className={`border-b border-[var(--border-color)] last:border-0 ${
                      p.name === selectedPlayer ? "bg-[var(--accent-blue)]/10" : ""
                    }`}
                  >
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="py-2 text-center">
                      <span className="badge-blue">{detail?.position ?? "-"}</span>
                    </td>
                    <td className="py-2 text-center tabular-nums">{p.rating.toFixed(1)}</td>
                    <td className="py-2 text-center tabular-nums">{p.xG.toFixed(1)}</td>
                    <td className="py-2 text-center tabular-nums">{p.goals}</td>
                    <td className="py-2 text-center tabular-nums">{p.assists}</td>
                    <td className="py-2 text-center tabular-nums">{p.shots}</td>
                    <td className="py-2 text-center tabular-nums">{p.vaepAttack.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Team Comparison Charts                                            */
/* ------------------------------------------------------------------ */

function TeamComparisonSection() {
  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "总进球", home: "9", away: "4", diff: "+5" },
          { label: "总xG", home: "7.8", away: "5.3", diff: "+2.5" },
          { label: "控球率均值", home: "55%", away: "45%", diff: "+10%" },
          { label: "射正率", home: "40%", away: "39%", diff: "+1%" },
        ].map((item) => (
          <div key={item.label} className="card text-center">
            <div className="text-xs text-[var(--text-muted)] mb-2">{item.label}</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-[var(--accent-blue)] tabular-nums">{item.home}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{currentMatch.homeTeam}</div>
              </div>
              <div className="text-xs font-medium text-[var(--accent-green)]">{item.diff}</div>
              <div>
                <div className="text-lg font-bold text-[var(--accent-green)] tabular-nums">{item.away}</div>
                <div className="text-[10px] text-[var(--text-muted)]">{currentMatch.awayTeam}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Comparison */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            数据指标对比 (总和)
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={teamComparisonData} layout="vertical" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="metric"
                tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                width={60}
              />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
              <Bar dataKey="home" name={currentMatch.homeTeam} fill={COLORS.blue} radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="away" name={currentMatch.awayTeam} fill={COLORS.green} radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Radar Comparison */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            综合能力对比
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={teamComparisonRadar} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke="var(--border-color)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                axisLine={false}
              />
              <Radar
                name={currentMatch.homeTeam}
                dataKey="home"
                stroke={COLORS.blue}
                fill={COLORS.blue}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Radar
                name={currentMatch.awayTeam}
                dataKey="away"
                stroke={COLORS.green}
                fill={COLORS.green}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Stats Table */}
      <div className="card">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          详细数据对比
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)]">
                <th className="pb-2 text-left text-xs font-medium text-[var(--text-muted)]">指标</th>
                <th className="pb-2 text-right text-xs font-medium text-[var(--accent-blue)]">
                  {currentMatch.homeTeam}
                </th>
                <th className="pb-2 w-20"></th>
                <th className="pb-2 text-left text-xs font-medium text-[var(--accent-green)]">
                  {currentMatch.awayTeam}
                </th>
              </tr>
            </thead>
            <tbody>
              {teamComparisonData.map((item) => {
                const homeWin = item.home > item.away;
                const isHigherBetter = item.metric !== "犯规";
                const homeBetter = isHigherBetter ? homeWin : !homeWin;
                return (
                  <tr key={item.metric} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="py-2 text-[var(--text-secondary)]">{item.metric}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${homeBetter ? "text-[var(--accent-blue)]" : ""}`}>
                      {item.home}
                    </td>
                    <td className="py-2 text-center text-xs text-[var(--text-muted)]">vs</td>
                    <td className={`py-2 text-left tabular-nums font-medium ${!homeBetter ? "text-[var(--accent-green)]" : ""}`}>
                      {item.away}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Historical Trend Charts                                           */
/* ------------------------------------------------------------------ */

function HistoricalTrendSection() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Win Rate Trend */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            月度胜率走势
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={historicalTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
              <Area
                type="monotone"
                dataKey="homeWinRate"
                name={currentMatch.homeTeam}
                stroke={COLORS.blue}
                fill={COLORS.blue}
                fillOpacity={0.15}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="awayWinRate"
                name={currentMatch.awayTeam}
                stroke={COLORS.green}
                fill={COLORS.green}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Goals Per Game Trend */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            场均进球走势
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={historicalTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 3]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
              <Line
                type="monotone"
                dataKey="homeGoalsPerGame"
                name={`${currentMatch.homeTeam} 场均进球`}
                stroke={COLORS.blue}
                strokeWidth={2}
                dot={{ fill: COLORS.blue, r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="awayGoalsPerGame"
                name={`${currentMatch.awayTeam} 场均进球`}
                stroke={COLORS.green}
                strokeWidth={2}
                dot={{ fill: COLORS.green, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clean Sheets */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            月度零封场次
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={historicalTrendData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
              <Bar dataKey="homeCleanSheets" name={currentMatch.homeTeam} fill={COLORS.blue} radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="awayCleanSheets" name={currentMatch.awayTeam} fill={COLORS.green} radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Combined Trend: Win Rate + Goals */}
        <div className="card">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            综合趋势 (胜率 + 场均进球)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={historicalTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="month" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 100]} unit="%" />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--text-muted)", fontSize: 11 }} domain={[0, 3]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "var(--text-secondary)" }} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="homeWinRate"
                name={`${currentMatch.homeTeam} 胜率`}
                stroke={COLORS.blue}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: COLORS.blue, r: 3 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="homeGoalsPerGame"
                name={`${currentMatch.homeTeam} 场均进球`}
                stroke={COLORS.purple}
                strokeWidth={2}
                dot={{ fill: COLORS.purple, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Stats Page                                                   */
/* ------------------------------------------------------------------ */

export default function StatsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("match");

  return (
    <div className="min-h-screen">
      <TopBar title="比赛统计" subtitle={`${currentMatch.homeTeam} vs ${currentMatch.awayTeam}`} />

      <div className="space-y-4 p-4 md:p-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "match" && <MatchStatsSection />}
        {activeTab === "player" && <PlayerStatsSection />}
        {activeTab === "comparison" && <TeamComparisonSection />}
        {activeTab === "history" && <HistoricalTrendSection />}
      </div>
    </div>
  );
}
