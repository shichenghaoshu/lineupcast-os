"use client";

import { memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface XGMatchEntry {
  match: string;
  homeXG: number;
  awayXG: number;
  homeTeam: string;
  awayTeam: string;
}

interface XGComparisonBarProps {
  data: XGMatchEntry[];
  homeColor?: string;
  awayColor?: string;
  className?: string;
}

function XGTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 font-medium text-[var(--text-primary)]">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[var(--text-secondary)]">{entry.name}:</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {entry.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export const XGComparisonBar = memo(function XGComparisonBar({
  data,
  homeColor = "#3b82f6",
  awayColor = "#ef4444",
  className = "",
}: XGComparisonBarProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        match: d.match,
        [d.homeTeam]: d.homeXG,
        [d.awayTeam]: d.awayXG,
      })),
    [data],
  );

  // Collect unique team names for bars
  const teamNames = useMemo(
    () => Array.from(new Set(data.flatMap((d) => [d.homeTeam, d.awayTeam]))),
    [data],
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-color)"
            vertical={false}
          />
          <XAxis
            dataKey="match"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "xG",
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-muted)",
              fontSize: 12,
            }}
          />
          <Tooltip content={<XGTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-xs text-[var(--text-secondary)]">
                {value}
              </span>
            )}
          />
          {teamNames.map((team, i) => (
            <Bar
              key={team}
              dataKey={team}
              fill={i % 2 === 0 ? homeColor : awayColor}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});
