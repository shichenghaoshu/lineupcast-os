"use client";

import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { H2HRecord } from "@/lib/types";

interface H2HExplorerProps {
  record: H2HRecord;
  homeTeam: string;
  awayTeam: string;
}

export function H2HExplorer({ record, homeTeam, awayTeam }: H2HExplorerProps) {
  const total = record.homeWins + record.draws + record.awayWins;
  const chartData = record.matches
    .slice()
    .reverse()
    .map((m) => ({
      match: new Date(m.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
      [homeTeam]: m.homeScore,
      [awayTeam]: m.awayScore,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="card"
    >
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        H2H · 历史交锋
      </div>

      {/* Summary Bar */}
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-[var(--accent-green)]">{record.homeWins}W</span>
        <div className="flex flex-1 overflow-hidden rounded-full h-2">
          <div
            className="bg-[var(--accent-green)]"
            style={{ width: `${(record.homeWins / total) * 100}%` }}
          />
          <div
            className="bg-[var(--accent-amber)]"
            style={{ width: `${(record.draws / total) * 100}%` }}
          />
          <div
            className="bg-[var(--accent-red)]"
            style={{ width: `${(record.awayWins / total) * 100}%` }}
          />
        </div>
        <span className="text-[var(--accent-red)]">{record.awayWins}W</span>
      </div>

      {/* Goals Chart */}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
          <XAxis dataKey="match" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
          <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              fontSize: "11px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px" }}
            iconSize={8}
          />
          <Bar dataKey={homeTeam} fill="var(--accent-green)" radius={[3, 3, 0, 0]} />
          <Bar dataKey={awayTeam} fill="var(--accent-blue)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Recent Meetings */}
      <div className="mt-3 space-y-1.5">
        {record.matches.slice(0, 4).map((m, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs"
          >
            <span className="text-[var(--text-muted)] w-16">
              {new Date(m.date).toLocaleDateString("zh-CN", { month: "short", year: "numeric" })}
            </span>
            <span className="font-medium">
              {m.homeTeam} <span className="text-[var(--accent-green)]">{m.homeScore}</span>
              {" - "}
              <span className="text-[var(--accent-blue)]">{m.awayScore}</span> {m.awayTeam}
            </span>
            <span className="text-[var(--text-muted)] w-16 text-right">{m.competition}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
