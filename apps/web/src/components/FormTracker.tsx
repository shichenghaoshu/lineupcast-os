"use client";

import { motion } from "framer-motion";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import type { FormEntry } from "@/lib/types";

interface FormTrackerProps {
  form: FormEntry[];
  teamName: string;
}

const resultColors: Record<string, string> = {
  W: "bg-[var(--accent-green)] text-black",
  D: "bg-[var(--accent-amber)] text-black",
  L: "bg-[var(--accent-red)] text-white",
};

export function FormTracker({ form, teamName }: FormTrackerProps) {
  const chartData = form
    .slice()
    .reverse()
    .map((f) => ({
      match: f.opponent.slice(0, 3).toUpperCase(),
      scored: f.goalsFor,
      conceded: f.goalsAgainst,
      xG: f.xG,
    }));

  const rollingXG = form.map((_, i) => {
    const window = form.slice(Math.max(0, i - 4), i + 1);
    const avg = window.reduce((sum, f) => sum + f.xG, 0) / window.length;
    return Math.round(avg * 100) / 100;
  });

  const avgXG = rollingXG[rollingXG.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="card"
    >
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        Form · 近期战绩 · {teamName}
      </div>

      {/* W/D/L Badges */}
      <div className="mb-3 flex items-center gap-1.5">
        {form.map((f, i) => (
          <span
            key={i}
            className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${resultColors[f.result]}`}
            title={`${f.date} vs ${f.opponent}: ${f.goalsFor}-${f.goalsAgainst}`}
          >
            {f.result}
          </span>
        ))}
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          近5场 xG: <span className="font-medium text-[var(--accent-green)]">{avgXG}</span>
        </span>
      </div>

      {/* Goals Chart */}
      <ResponsiveContainer width="100%" height={160}>
        <ComposedChart data={chartData}>
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
          <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
          <Bar dataKey="scored" fill="var(--accent-green)" name="进球" radius={[3, 3, 0, 0]} />
          <Bar dataKey="conceded" fill="var(--accent-red)" name="失球" radius={[3, 3, 0, 0]} />
          <Line
            type="monotone"
            dataKey="xG"
            stroke="var(--accent-amber)"
            strokeWidth={2}
            dot={{ fill: "var(--accent-amber)", r: 3 }}
            name="xG"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Recent Matches List */}
      <div className="mt-3 space-y-1">
        {form.slice(0, 3).map((f, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md bg-[var(--bg-primary)] px-2.5 py-1.5 text-xs"
          >
            <span className={`h-5 w-5 flex items-center justify-center rounded text-[10px] font-bold ${resultColors[f.result]}`}>
              {f.result}
            </span>
            <span className="flex-1 px-2 font-medium">
              {f.isHome ? "vs" : "@"} {f.opponent}
            </span>
            <span className="tabular-nums">
              {f.goalsFor}-{f.goalsAgainst}
            </span>
            <span className="ml-2 w-10 text-right text-[var(--text-muted)]">
              xG {f.xG}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
