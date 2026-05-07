"use client";

import { memo, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface WinProbabilityGaugeProps {
  homeWin: number;
  draw: number;
  awayWin: number;
  homeTeam: string;
  awayTeam: string;
  className?: string;
}

const COLORS = {
  home: "#3b82f6",
  draw: "#f59e0b",
  away: "#ef4444",
};

function GaugeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="card px-3 py-2 text-sm shadow-lg">
      <span className="text-[var(--text-secondary)]">{entry.name}: </span>
      <span className="font-semibold text-[var(--text-primary)]">
        {entry.value.toFixed(1)}%
      </span>
    </div>
  );
}

export const WinProbabilityGauge = memo(function WinProbabilityGauge({
  homeWin,
  draw,
  awayWin,
  homeTeam,
  awayTeam,
  className = "",
}: WinProbabilityGaugeProps) {
  const data = useMemo(
    () => [
      { name: homeTeam, value: homeWin },
      { name: "Draw", value: draw },
      { name: awayTeam, value: awayWin },
    ],
    [homeTeam, homeWin, draw, awayTeam, awayWin],
  );

  // Semi-circle gauge: pad to 180 degrees
  const gaugeData = useMemo(
    () => [...data, { name: "__pad", value: 0 }],
    [data],
  );

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative w-full max-w-[280px] aspect-square">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              dataKey="value"
              cx="50%"
              cy="90%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="95%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={
                    i === 0
                      ? COLORS.home
                      : i === 1
                        ? COLORS.draw
                        : COLORS.away
                  }
                />
              ))}
              <Cell fill="transparent" />
            </Pie>
            <Tooltip content={<GaugeTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-center">
          <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
            Win Probability
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4 text-sm">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor:
                  entry.name === homeTeam
                    ? COLORS.home
                    : entry.name === "Draw"
                      ? COLORS.draw
                      : COLORS.away,
              }}
            />
            <span className="text-[var(--text-secondary)]">{entry.name}</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
