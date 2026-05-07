"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  Star,
  Trophy,
  X,
} from "lucide-react";
import type { Player } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────

type SortKey =
  | "name"
  | "position"
  | "age"
  | "recentRating"
  | "xGLast5"
  | "shotsLast5"
  | "assistsLast5"
  | "foulsPer90"
  | "yellowCardsLast10"
  | "vaepAttack"
  | "vaepDefense";

type SortDirection = "asc" | "desc";

type PositionGroup = "All" | "GK" | "DEF" | "MID" | "FWD";

interface PlayerStatsTableProps {
  players: Player[];
  title?: string;
  subtitle?: string;
  /** Number of top performers to highlight (default: 3) */
  topN?: number;
  /** Whether to show the export button (default: true) */
  showExport?: boolean;
  /** Whether to show the position filter (default: true) */
  showFilter?: boolean;
  /** Whether to show the search bar (default: true) */
  showSearch?: boolean;
}

// ── Position grouping ──────────────────────────────────────────────────

const POSITION_GROUPS: Record<PositionGroup, string[]> = {
  All: [],
  GK: ["GK"],
  DEF: ["CB", "LB", "RB", "LWB", "RWB"],
  MID: ["DM", "CDM", "CM", "CAM", "AM", "LM", "RM"],
  FWD: ["LW", "RW", "CF", "ST"],
};

function getPositionGroup(position: string): PositionGroup {
  for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
    if (group !== "All" && positions.includes(position)) {
      return group as PositionGroup;
    }
  }
  return "MID"; // fallback
}

// ── Column definitions ─────────────────────────────────────────────────

interface Column {
  key: SortKey;
  label: string;
  labelEn: string;
  sortable: boolean;
  align?: "left" | "right" | "center";
  format?: (value: number) => string;
}

const COLUMNS: Column[] = [
  { key: "name", label: "球员", labelEn: "Player", sortable: true, align: "left" },
  { key: "position", label: "位置", labelEn: "Pos", sortable: true, align: "center" },
  { key: "age", label: "年龄", labelEn: "Age", sortable: true, align: "center" },
  {
    key: "recentRating",
    label: "评分",
    labelEn: "Rating",
    sortable: true,
    align: "center",
    format: (v) => v.toFixed(1),
  },
  {
    key: "xGLast5",
    label: "xG/5场",
    labelEn: "xG/5",
    sortable: true,
    align: "right",
    format: (v) => v.toFixed(1),
  },
  {
    key: "shotsLast5",
    label: "射门/5场",
    labelEn: "Shots/5",
    sortable: true,
    align: "right",
  },
  {
    key: "assistsLast5",
    label: "助攻/5场",
    labelEn: "Ast/5",
    sortable: true,
    align: "right",
  },
  {
    key: "foulsPer90",
    label: "犯规/90",
    labelEn: "Fouls/90",
    sortable: true,
    align: "right",
    format: (v) => v.toFixed(1),
  },
  {
    key: "yellowCardsLast10",
    label: "黄牌/10场",
    labelEn: "YC/10",
    sortable: true,
    align: "right",
  },
  {
    key: "vaepAttack",
    label: "进攻VAEP",
    labelEn: "Att VAEP",
    sortable: true,
    align: "right",
    format: (v) => v.toFixed(2),
  },
  {
    key: "vaepDefense",
    label: "防守VAEP",
    labelEn: "Def VAEP",
    sortable: true,
    align: "right",
    format: (v) => v.toFixed(2),
  },
];

// ── CSV export helper ──────────────────────────────────────────────────

function exportToCSV(players: Player[], filename: string) {
  const headers = [
    "Name",
    "Number",
    "Position",
    "Role",
    "Age",
    "Nationality",
    "Rating",
    "xG Last 5",
    "Shots Last 5",
    "Assists Last 5",
    "Fouls/90",
    "Yellow Cards/10",
    "Red Cards/10",
    "VAEP Attack",
    "VAEP Defense",
  ];

  const rows = players.map((p) => [
    p.name,
    p.number,
    p.position,
    p.role,
    p.age,
    p.nationality,
    p.recentRating.toFixed(1),
    p.xGLast5.toFixed(2),
    p.shotsLast5,
    p.assistsLast5,
    p.foulsPer90.toFixed(2),
    p.yellowCardsLast10,
    p.redCardsLast10,
    p.vaepAttack.toFixed(3),
    p.vaepDefense.toFixed(3),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    ),
  ].join("\n");

  const blob = new Blob(["﻿" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Component ──────────────────────────────────────────────────────────

export function PlayerStatsTable({
  players,
  title = "球员数据统计",
  subtitle,
  topN = 3,
  showExport = true,
  showFilter = true,
  showSearch = true,
}: PlayerStatsTableProps) {
  // State
  const [sortKey, setSortKey] = useState<SortKey>("recentRating");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [positionFilter, setPositionFilter] = useState<PositionGroup>("All");

  // Identify top performers by rating
  const topPerformerIds = useMemo(() => {
    const sorted = [...players].sort(
      (a, b) => b.recentRating - a.recentRating,
    );
    return new Set(sorted.slice(0, topN).map((p) => p.id));
  }, [players, topN]);

  // Get unique position groups present in data
  const availablePositionGroups = useMemo(() => {
    const groups = new Set<PositionGroup>();
    groups.add("All");
    players.forEach((p) => groups.add(getPositionGroup(p.position)));
    return Array.from(groups);
  }, [players]);

  // Filter and sort
  const processedPlayers = useMemo(() => {
    let result = [...players];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.position.toLowerCase().includes(query) ||
          p.role.toLowerCase().includes(query) ||
          p.nationality.toLowerCase().includes(query),
      );
    }

    // Filter by position group
    if (positionFilter !== "All") {
      const allowedPositions = POSITION_GROUPS[positionFilter];
      result = result.filter((p) => allowedPositions.includes(p.position));
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number = a[sortKey] as string | number;
      let bVal: string | number = b[sortKey] as string | number;

      // Handle string sorting
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Handle numeric sorting
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      return sortDir === "asc" ? aNum - bNum : bNum - aNum;
    });

    return result;
  }, [players, searchQuery, positionFilter, sortKey, sortDir]);

  // Handle sort click
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir(key === "name" || key === "position" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  // Handle export
  const handleExport = useCallback(() => {
    const timestamp = new Date().toISOString().slice(0, 10);
    exportToCSV(processedPlayers, `player_stats_${timestamp}.csv`);
  }, [processedPlayers]);

  // Rating color
  const getRatingColor = (rating: number): string => {
    if (rating >= 7.5) return "text-[var(--accent-green)]";
    if (rating >= 7.0) return "text-[var(--accent-blue)]";
    if (rating >= 6.5) return "text-[var(--accent-amber)]";
    return "text-[var(--text-muted)]";
  };

  // Position group badge color
  const getPositionGroupBadge = (position: string): string => {
    const group = getPositionGroup(position);
    switch (group) {
      case "GK":
        return "badge-purple";
      case "DEF":
        return "badge-blue";
      case "MID":
        return "badge-green";
      case "FWD":
        return "badge-amber";
      default:
        return "badge";
    }
  };

  // Alignment class
  const alignClass = (align?: string) => {
    switch (align) {
      case "right":
        return "text-right";
      case "center":
        return "text-center";
      default:
        return "text-left";
    }
  };

  const positionGroupLabels: Record<PositionGroup, { zh: string; en: string }> = {
    All: { zh: "全部", en: "All" },
    GK: { zh: "门将", en: "GK" },
    DEF: { zh: "后卫", en: "DEF" },
    MID: { zh: "中场", en: "MID" },
    FWD: { zh: "前锋", en: "FWD" },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{title}</div>
          {subtitle && (
            <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showExport && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded border border-[var(--border-color)] px-2.5 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        {showSearch && (
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索球员名称、位置、国籍..."
              className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] py-1.5 pl-8 pr-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Position filter buttons */}
        {showFilter && (
          <div className="flex items-center gap-1.5">
            {availablePositionGroups.map((group) => (
              <button
                key={group}
                onClick={() => setPositionFilter(group)}
                className={`rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                  positionFilter === group
                    ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {positionGroupLabels[group].zh}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
        <span>
          显示 {processedPlayers.length} / {players.length} 名球员
        </span>
        {topPerformerIds.size > 0 && (
          <span className="flex items-center gap-1 text-[var(--accent-amber)]">
            <Trophy className="h-3 w-3" />
            Top {topN} 球员已标记
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-[var(--border-color)]">
        <table className="w-full min-w-[900px] text-xs">
          <thead>
            <tr className="bg-[var(--bg-primary)]">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 font-medium text-[var(--text-muted)] ${alignClass(col.align)} ${
                    col.sortable
                      ? "cursor-pointer select-none hover:text-[var(--text-secondary)]"
                      : ""
                  }`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div
                    className={`flex items-center gap-1 ${
                      col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""
                    }`}
                  >
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="inline-flex flex-col">
                        {sortKey === col.key ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-[var(--accent-blue)]" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-[var(--accent-blue)]" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {processedPlayers.map((player, i) => {
                const isTop = topPerformerIds.has(player.id);
                return (
                  <motion.tr
                    key={player.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, delay: i * 0.02 }}
                    className={`border-t border-[var(--border-color)] transition-colors ${
                      isTop
                        ? "bg-[var(--accent-amber)]/5 hover:bg-[var(--accent-amber)]/10"
                        : i % 2 === 0
                          ? "bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)]"
                          : "bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)]"
                    }`}
                  >
                    {/* Name */}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {isTop && (
                          <Star className="h-3.5 w-3.5 flex-shrink-0 text-[var(--accent-amber)]" />
                        )}
                        <div className="min-w-0">
                          <div
                            className={`truncate font-medium ${
                              isTop ? "text-[var(--accent-amber)]" : "text-[var(--text-primary)]"
                            }`}
                          >
                            {player.name}
                          </div>
                          <div className="text-[10px] text-[var(--text-muted)]">
                            #{player.number} · {player.nationality}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Position */}
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`${getPositionGroupBadge(player.position)} text-[10px]`}
                      >
                        {player.position}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="px-3 py-2 text-center tabular-nums text-[var(--text-secondary)]">
                      {player.age}
                    </td>

                    {/* Rating */}
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold tabular-nums ${getRatingColor(player.recentRating)}`}
                      >
                        <Star className="h-3 w-3" />
                        {player.recentRating.toFixed(1)}
                      </span>
                    </td>

                    {/* xG Last 5 */}
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`tabular-nums ${
                          player.xGLast5 >= 1.0
                            ? "font-semibold text-[var(--accent-green)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {player.xGLast5.toFixed(1)}
                      </span>
                    </td>

                    {/* Shots Last 5 */}
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`tabular-nums ${
                          player.shotsLast5 >= 10
                            ? "font-semibold text-[var(--accent-green)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {player.shotsLast5}
                      </span>
                    </td>

                    {/* Assists Last 5 */}
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`tabular-nums ${
                          player.assistsLast5 >= 3
                            ? "font-semibold text-[var(--accent-green)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {player.assistsLast5}
                      </span>
                    </td>

                    {/* Fouls per 90 */}
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`tabular-nums ${
                          player.foulsPer90 >= 2.0
                            ? "font-semibold text-[var(--accent-red)]"
                            : player.foulsPer90 >= 1.5
                              ? "text-[var(--accent-amber)]"
                              : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {player.foulsPer90.toFixed(1)}
                      </span>
                    </td>

                    {/* Yellow Cards */}
                    <td className="px-3 py-2 text-right">
                      <span
                        className={`tabular-nums ${
                          player.yellowCardsLast10 >= 3
                            ? "font-semibold text-[var(--accent-amber)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      >
                        {player.yellowCardsLast10}
                      </span>
                    </td>

                    {/* VAEP Attack */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent-green)]"
                            style={{
                              width: `${Math.min(player.vaepAttack * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums text-[var(--text-secondary)]">
                          {player.vaepAttack.toFixed(2)}
                        </span>
                      </div>
                    </td>

                    {/* VAEP Defense */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent-blue)]"
                            style={{
                              width: `${Math.min(player.vaepDefense * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums text-[var(--text-secondary)]">
                          {player.vaepDefense.toFixed(2)}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {processedPlayers.length === 0 && (
        <div className="py-8 text-center text-sm text-[var(--text-muted)]">
          未找到匹配的球员
        </div>
      )}

      {/* Summary stats */}
      {processedPlayers.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded bg-[var(--bg-primary)] px-3 py-2 text-[10px] text-[var(--text-muted)]">
          <span>
            平均评分:{" "}
            <span className="font-medium text-[var(--text-secondary)]">
              {(
                processedPlayers.reduce((sum, p) => sum + p.recentRating, 0) /
                processedPlayers.length
              ).toFixed(1)}
            </span>
          </span>
          <span className="text-[var(--border-color)]">|</span>
          <span>
            总 xG:{" "}
            <span className="font-medium text-[var(--accent-green)]">
              {processedPlayers
                .reduce((sum, p) => sum + p.xGLast5, 0)
                .toFixed(1)}
            </span>
          </span>
          <span className="text-[var(--border-color)]">|</span>
          <span>
            总助攻:{" "}
            <span className="font-medium text-[var(--accent-blue)]">
              {processedPlayers.reduce((sum, p) => sum + p.assistsLast5, 0)}
            </span>
          </span>
          <span className="text-[var(--border-color)]">|</span>
          <span>
            总射门:{" "}
            <span className="font-medium text-[var(--text-secondary)]">
              {processedPlayers.reduce((sum, p) => sum + p.shotsLast5, 0)}
            </span>
          </span>
        </div>
      )}
    </motion.div>
  );
}
