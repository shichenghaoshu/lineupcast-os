"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Users,
  Star,
  Target,
  Crosshair,
  AlertTriangle,
  X,
  Plus,
  BarChart3,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { DemoBadge } from "@/components/DemoBadge";
import { loadLineups } from "@/lib/data-loader";
import {
  comparePlayers,
  type PlayerComparisonData,
  type PlayerComparisonItem,
} from "@/lib/api-client";
import type { Player } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Color palette for player overlays                                 */
/* ------------------------------------------------------------------ */

const PLAYER_COLORS = [
  { fill: "var(--accent-blue)", stroke: "var(--accent-blue)", bg: "bg-[var(--accent-blue)]" },
  { fill: "var(--accent-green)", stroke: "var(--accent-green)", bg: "bg-[var(--accent-green)]" },
  { fill: "var(--accent-amber)", stroke: "var(--accent-amber)", bg: "bg-[var(--accent-amber)]" },
  { fill: "var(--accent-purple)", stroke: "var(--accent-purple)", bg: "bg-[var(--accent-purple)]" },
];

/* ------------------------------------------------------------------ */
/*  Radar chart dimension config                                      */
/* ------------------------------------------------------------------ */

interface RadarDimension {
  key: keyof PlayerComparisonItem;
  label: string;
  maxValue: number;
}

const RADAR_DIMENSIONS: RadarDimension[] = [
  { key: "recentRating", label: "评分", maxValue: 10 },
  { key: "xGLast5", label: "xG/5场", maxValue: 3 },
  { key: "shotsLast5", label: "射门/5场", maxValue: 20 },
  { key: "assistsLast5", label: "助攻/5场", maxValue: 8 },
  { key: "vaepAttack", label: "进攻VAEP", maxValue: 1 },
  { key: "vaepDefense", label: "防守VAEP", maxValue: 1 },
];

/* ------------------------------------------------------------------ */
/*  Normalize a value to 0-100 for radar chart                        */
/* ------------------------------------------------------------------ */

function normalizeToRadar(value: number, maxValue: number): number {
  return Math.round(Math.min(100, (value / maxValue) * 100));
}

/* ------------------------------------------------------------------ */
/*  Build radar chart data from selected players                      */
/* ------------------------------------------------------------------ */

function buildRadarData(items: PlayerComparisonItem[]) {
  return RADAR_DIMENSIONS.map((dim) => {
    const point: Record<string, string | number> = { dimension: dim.label };
    items.forEach((player) => {
      const raw = player[dim.key];
      point[player.name] = normalizeToRadar(
        typeof raw === "number" ? raw : 0,
        dim.maxValue,
      );
    });
    return point;
  });
}

/* ------------------------------------------------------------------ */
/*  Build historical form chart data from comparison items            */
/* ------------------------------------------------------------------ */

function buildFormChartData(items: PlayerComparisonItem[]) {
  // Generate mock historical rating data for each player (last 8 matchdays)
  const matchdays = ["MD25", "MD26", "MD27", "MD28", "MD29", "MD30", "MD31", "MD32"];
  return matchdays.map((md, i) => {
    const point: Record<string, string | number> = { match: md };
    items.forEach((player, idx) => {
      // Simulate fluctuating form around recentRating
      const base = player.recentRating;
      const variance = [-0.3, 0.1, -0.2, 0.4, -0.1, 0.2, -0.4, 0.3][i];
      const playerOffset = idx * 0.05;
      point[player.name] =
        Math.round((base + variance + playerOffset + (Math.sin(i + idx) * 0.2)) * 10) / 10;
    });
    return point;
  });
}

/* ------------------------------------------------------------------ */
/*  Stat comparison table rows                                        */
/* ------------------------------------------------------------------ */

interface StatRow {
  label: string;
  key: keyof PlayerComparisonItem;
  format: (v: number) => string;
  highlight: "high" | "low"; // high = higher is better, low = lower is better
}

const STAT_ROWS: StatRow[] = [
  { label: "近期评分", key: "recentRating", format: (v) => v.toFixed(1), highlight: "high" },
  { label: "xG / 5场", key: "xGLast5", format: (v) => v.toFixed(1), highlight: "high" },
  { label: "射门 / 5场", key: "shotsLast5", format: (v) => String(v), highlight: "high" },
  { label: "助攻 / 5场", key: "assistsLast5", format: (v) => String(v), highlight: "high" },
  { label: "犯规 / 90", key: "foulsPer90", format: (v) => v.toFixed(1), highlight: "low" },
  { label: "黄牌 / 10场", key: "yellowCardsLast10", format: (v) => String(v), highlight: "low" },
  { label: "红牌 / 10场", key: "redCardsLast10", format: (v) => String(v), highlight: "low" },
  { label: "进攻 VAEP", key: "vaepAttack", format: (v) => v.toFixed(2), highlight: "high" },
  { label: "防守 VAEP", key: "vaepDefense", format: (v) => v.toFixed(2), highlight: "high" },
];

/* ------------------------------------------------------------------ */
/*  Main page component                                               */
/* ------------------------------------------------------------------ */

export default function ComparePage() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<PlayerComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // Load all players on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchPlayers() {
      const result = await loadLineups("match-001");
      if (cancelled) return;
      setAllPlayers(result.data);
      setIsDemo(result.isDemo);
      setLoading(false);
    }

    fetchPlayers();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch comparison data when selection changes
  useEffect(() => {
    if (selectedIds.length < 2) {
      setComparisonData(null);
      return;
    }

    let cancelled = false;

    async function fetchComparison() {
      const data = await comparePlayers(selectedIds);
      if (cancelled) return;
      setComparisonData(data);
    }

    fetchComparison();
    return () => {
      cancelled = true;
    };
  }, [selectedIds]);

  const togglePlayer = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        if (prev.includes(id)) {
          return prev.filter((pid) => pid !== id);
        }
        if (prev.length >= 4) return prev;
        return [...prev, id];
      });
    },
    [],
  );

  const removePlayer = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((pid) => pid !== id));
  }, []);

  const selectedPlayers = useMemo(
    () => allPlayers.filter((p) => selectedIds.includes(p.id)),
    [allPlayers, selectedIds],
  );

  const availablePlayers = useMemo(
    () => allPlayers.filter((p) => !selectedIds.includes(p.id)),
    [allPlayers, selectedIds],
  );

  const radarData = useMemo(
    () => (comparisonData ? buildRadarData(comparisonData.players) : []),
    [comparisonData],
  );

  const formChartData = useMemo(
    () => (comparisonData ? buildFormChartData(comparisonData.players) : []),
    [comparisonData],
  );

  // Determine best value for each stat row
  const bestValues = useMemo(() => {
    if (!comparisonData) return {};
    const result: Record<string, number> = {};
    STAT_ROWS.forEach((row) => {
      const values = comparisonData.players.map((p) => p[row.key] as number);
      if (row.highlight === "high") {
        result[row.key] = Math.max(...values);
      } else {
        result[row.key] = Math.min(...values);
      }
    });
    return result;
  }, [comparisonData]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-blue)]" />
        <span className="ml-2 text-sm text-[var(--text-muted)]">
          Loading player data...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between">
        <TopBar
          title="球员对比"
          subtitle="选择 2-4 名球员进行多维度数据对比分析"
        />
        {isDemo && (
          <div className="fixed right-4 top-3 z-50">
            <DemoBadge />
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 md:p-6">
        {/* Player Selection Bar */}
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              已选球员 ({selectedIds.length}/4)
            </div>
            {selectedIds.length >= 2 && (
              <span className="badge-green text-[10px]">
                <BarChart3 className="mr-1 inline h-3 w-3" />
                对比中
              </span>
            )}
          </div>

          {/* Selected player chips */}
          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {selectedPlayers.map((player, index) => (
                <motion.button
                  key={player.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => removePlayer(player.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent-red)]/40 hover:bg-[var(--accent-red)]/10 ${PLAYER_COLORS[index].bg}/20 border-[var(--border-color)]`}
                >
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-black"
                    style={{ background: PLAYER_COLORS[index].fill }}
                  >
                    {player.number}
                  </div>
                  <span className="font-medium">{player.name}</span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {player.position}
                  </span>
                  <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                </motion.button>
              ))}
            </AnimatePresence>

            {/* Add player button */}
            {selectedIds.length < 4 && (
              <button
                onClick={() => setSelectorOpen(!selectorOpen)}
                className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
              >
                <Plus className="h-3.5 w-3.5" />
                添加球员
              </button>
            )}
          </div>

          {/* Player selector dropdown */}
          <AnimatePresence>
            {selectorOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]">
                  {availablePlayers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[var(--text-muted)]">
                      所有球员已选中
                    </div>
                  ) : (
                    availablePlayers.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => {
                          togglePlayer(player.id);
                          if (selectedIds.length >= 3) setSelectorOpen(false);
                        }}
                        className="flex w-full items-center gap-3 border-b border-[var(--border-color)] px-3 py-2 text-left text-sm transition-colors last:border-0 hover:bg-[var(--bg-card)]"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-blue)]/20 text-xs font-bold text-[var(--accent-blue)]">
                          {player.number}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {player.name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {player.position} &middot; {player.nationality}
                            &middot; {player.age}岁
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 text-[var(--accent-amber)]" />
                          <span className="tabular-nums">
                            {player.recentRating.toFixed(1)}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Prompt when less than 2 selected */}
        {selectedIds.length < 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card flex flex-col items-center justify-center py-12 text-center"
          >
            <Users className="mb-3 h-10 w-10 text-[var(--text-muted)]" />
            <div className="text-sm text-[var(--text-secondary)]">
              请从上方选择至少 2 名球员开始对比
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">
              最多可选 4 名球员进行多维度对比分析
            </div>
          </motion.div>
        )}

        {/* Comparison Content */}
        {comparisonData && comparisonData.players.length >= 2 && (
          <div className="space-y-4">
            {/* Player Overview Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {comparisonData.players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="card space-y-2"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-black"
                      style={{ background: PLAYER_COLORS[index].fill }}
                    >
                      {player.number}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{player.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {player.position} &middot; {player.role}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-[var(--accent-amber)]" />
                      <span className="text-lg font-bold tabular-nums">
                        {player.recentRating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">xG</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {player.xGLast5.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">射门</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {player.shotsLast5}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--text-muted)]">助攻</div>
                      <div className="text-sm font-semibold tabular-nums">
                        {player.assistsLast5}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-1 text-[var(--accent-green)]">
                      <Target className="h-2.5 w-2.5" />
                      ATK {player.vaepAttack.toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1 text-[var(--accent-blue)]">
                      <Crosshair className="h-2.5 w-2.5" />
                      DEF {player.vaepDefense.toFixed(2)}
                    </span>
                    {player.yellowCardsLast10 > 2 && (
                      <span className="flex items-center gap-1 text-[var(--accent-amber)]">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {player.yellowCardsLast10}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Radar Chart + Stat Table side by side */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Radar Chart */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card lg:col-span-5"
              >
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  雷达图对比
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border-color)" />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        fontSize: "11px",
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: "11px" }}
                      iconSize={8}
                    />
                    {comparisonData.players.map((player, index) => (
                      <Radar
                        key={player.id}
                        name={player.name}
                        dataKey={player.name}
                        stroke={PLAYER_COLORS[index].stroke}
                        fill={PLAYER_COLORS[index].fill}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                    ))}
                  </RadarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Stat Comparison Table */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="card lg:col-span-7"
              >
                <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  数据对比表
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border-color)]">
                        <th className="pb-2 pr-3 text-left text-xs font-medium text-[var(--text-muted)]">
                          指标
                        </th>
                        {comparisonData.players.map((player, index) => (
                          <th
                            key={player.id}
                            className="pb-2 px-2 text-center text-xs font-medium"
                            style={{ color: PLAYER_COLORS[index].fill }}
                          >
                            <div className="truncate max-w-[80px]">{player.name}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STAT_ROWS.map((row) => {
                        const best = bestValues[row.key];
                        return (
                          <tr
                            key={row.key}
                            className="border-b border-[var(--border-color)]/50 last:border-0"
                          >
                            <td className="py-2 pr-3 text-xs text-[var(--text-secondary)]">
                              {row.label}
                            </td>
                            {comparisonData.players.map((player) => {
                              const value = player[row.key] as number;
                              const isBest = value === best && comparisonData.players.length > 1;
                              return (
                                <td
                                  key={player.id}
                                  className={`py-2 px-2 text-center tabular-nums ${
                                    isBest
                                      ? "font-bold text-[var(--accent-green)]"
                                      : "text-[var(--text-primary)]"
                                  }`}
                                >
                                  {row.format(value)}
                                  {isBest && (
                                    <span className="ml-1 text-[8px] text-[var(--accent-green)]">
                                      BEST
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>

            {/* Historical Form Comparison */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="card"
            >
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-[var(--accent-purple)]" />
                <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  近期状态走势对比
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={formChartData}>
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
                    domain={[6, 8.5]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      fontSize: "11px",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px" }}
                    iconSize={8}
                  />
                  {comparisonData.players.map((player, index) => (
                    <Line
                      key={player.id}
                      type="monotone"
                      dataKey={player.name}
                      stroke={PLAYER_COLORS[index].stroke}
                      strokeWidth={2}
                      dot={{ fill: PLAYER_COLORS[index].fill, r: 4 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            {/* AI Commentary Summary */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="card space-y-2"
            >
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                AI 对比分析
              </div>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {buildCommentary(comparisonData.players)}
              </p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Commentary builder                                             */
/* ------------------------------------------------------------------ */

function buildCommentary(players: PlayerComparisonItem[]): string {
  if (players.length < 2) return "";

  const sorted = [...players].sort((a, b) => b.recentRating - a.recentRating);
  const top = sorted[0];
  const second = sorted[1];

  const attackSorted = [...players].sort(
    (a, b) => b.vaepAttack - a.vaepAttack,
  );
  const defenseSorted = [...players].sort(
    (a, b) => b.vaepDefense - a.vaepDefense,
  );

  const parts: string[] = [];

  parts.push(
    `综合评分来看，${top.name} (${top.recentRating.toFixed(1)}) 略高于 ${second.name} (${second.recentRating.toFixed(1)})。`,
  );

  if (attackSorted[0].vaepAttack > attackSorted[1].vaepAttack + 0.1) {
    parts.push(
      `进攻端 ${attackSorted[0].name} 的 VAEP 进攻值 (${attackSorted[0].vaepAttack.toFixed(2)}) 明显领先，是更具威胁的攻击点。`,
    );
  }

  if (defenseSorted[0].vaepDefense > defenseSorted[1].vaepDefense + 0.1) {
    parts.push(
      `防守贡献方面 ${defenseSorted[0].name} (${defenseSorted[0].vaepDefense.toFixed(2)}) 表现更佳。`,
    );
  }

  const highDisciplineRisk = players.filter((p) => p.foulsPer90 > 1.5);
  if (highDisciplineRisk.length > 0) {
    parts.push(
      `需要注意 ${highDisciplineRisk.map((p) => p.name).join("、")} 的犯规频率较高，黄牌风险不容忽视。`,
    );
  }

  const topScorer = [...players].sort(
    (a, b) => b.xGLast5 - a.xGLast5,
  )[0];
  if (topScorer.xGLast5 > 1.0) {
    parts.push(
      `${topScorer.name} 近5场 xG 达到 ${topScorer.xGLast5.toFixed(1)}，门前把握机会能力突出。`,
    );
  }

  return parts.join("");
}
