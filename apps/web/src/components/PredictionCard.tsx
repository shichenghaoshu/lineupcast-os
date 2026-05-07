"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { progressBarAnimate } from "@/lib/animations";
import { Card } from "@/components/Card";

interface PredictionCardProps {
  homeWin: number;
  draw: number;
  awayWin: number;
  homeTeam: string;
  awayTeam: string;
}

export const PredictionCard = memo(function PredictionCard({
  homeWin,
  draw,
  awayWin,
  homeTeam,
  awayTeam,
}: PredictionCardProps) {
  const max = useMemo(() => Math.max(homeWin, draw, awayWin), [homeWin, draw, awayWin]);

  return (
    <Card className="space-y-3">
      <Card.Header>胜率推演</Card.Header>
      <Card.Body>
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
                {...progressBarAnimate((item.value / max) * 100)}
                className="h-full rounded-full"
                style={{ backgroundColor: item.color }}
              />
            </div>
          </div>
        ))}
      </div>
      </Card.Body>
    </Card>
  );
});
