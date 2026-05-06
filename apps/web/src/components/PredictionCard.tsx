"use client";

import { motion } from "framer-motion";

interface PredictionCardProps {
  homeWin: number;
  draw: number;
  awayWin: number;
  homeTeam: string;
  awayTeam: string;
}

export function PredictionCard({
  homeWin,
  draw,
  awayWin,
  homeTeam,
  awayTeam,
}: PredictionCardProps) {
  const max = Math.max(homeWin, draw, awayWin);

  return (
    <div className="card space-y-3">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        胜率推演
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: homeTeam, value: homeWin, color: "var(--accent-green)" },
          { label: "平局", value: draw, color: "var(--accent-amber)" },
          { label: awayTeam, value: awayWin, color: "var(--accent-blue)" },
        ].map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="text-xs text-[var(--text-muted)]">{item.label}</div>
            <div
              className="text-2xl font-bold tabular-nums"
              style={{ color: item.color }}
            >
              {item.value}%
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
