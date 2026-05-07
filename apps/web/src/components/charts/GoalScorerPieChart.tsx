"use client";

import { memo, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";

export interface ScorerSlice {
  name: string;
  goals: number;
  probability: number;
}

interface GoalScorerPieChartProps {
  scorers: ScorerSlice[];
  className?: string;
}

const PALETTE = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

function ScorerTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: ScorerSlice }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  return (
    <div className="card px-3 py-2 text-sm shadow-lg">
      <div className="font-semibold text-[var(--text-primary)]">
        {entry.name}
      </div>
      <div className="mt-1 space-y-0.5">
        <div>
          <span className="text-[var(--text-secondary)]">Goals: </span>
          <span className="font-medium text-[var(--text-primary)]">
            {entry.goals}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">Probability: </span>
          <span className="font-medium text-[var(--text-primary)]">
            {entry.probability.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function renderLegendLabel({
  value,
  payload,
}: {
  value: string;
  payload?: { color: string };
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: payload?.color }}
      />
      {value}
    </span>
  );
}

export const GoalScorerPieChart = memo(function GoalScorerPieChart({
  scorers,
  className = "",
}: GoalScorerPieChartProps) {
  const data = useMemo(
    () => scorers.map((s) => ({ ...s, value: s.probability })),
    [scorers],
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius="70%"
            innerRadius="35%"
            paddingAngle={2}
            stroke="none"
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={{ stroke: "var(--text-muted)", strokeWidth: 1 }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip content={<ScorerTooltip />} />
          <Legend
            formatter={renderLegendLabel}
            wrapperStyle={{ paddingTop: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
});
