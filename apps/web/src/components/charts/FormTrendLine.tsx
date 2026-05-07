"use client";

import { memo, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface FormMatchEntry {
  matchday: string;
  points: number;
  cumulativeAvg: number;
  opponent: string;
  result: "W" | "D" | "L";
}

interface FormTrendLineProps {
  data: FormMatchEntry[];
  teamName: string;
  className?: string;
}

const RESULT_COLORS: Record<string, string> = {
  W: "#10b981",
  D: "#f59e0b",
  L: "#ef4444",
};

function FormTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; dataKey: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const matchData = payload[0]?.payload as FormMatchEntry | undefined;

  return (
    <div className="card px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 font-medium text-[var(--text-primary)]">
        {label}
        {matchData?.opponent && (
          <span className="text-[var(--text-muted)]">
            {" "}
            vs {matchData.opponent}
          </span>
        )}
      </div>
      {matchData && (
        <div className="mb-1">
          <span
            className="inline-block rounded px-1.5 py-0.5 text-xs font-bold"
            style={{
              backgroundColor:
                RESULT_COLORS[matchData.result] + "33",
              color: RESULT_COLORS[matchData.result],
            }}
          >
            {matchData.result}
          </span>
        </div>
      )}
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="text-[var(--text-secondary)]">{entry.name}:</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {entry.value.toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export const FormTrendLine = memo(function FormTrendLine({
  data,
  teamName,
  className = "",
}: FormTrendLineProps) {
  const chartData = useMemo(
    () => data.map((d) => ({ ...d, matchday: d.matchday })),
    [data],
  );

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-color)"
            vertical={false}
          />
          <XAxis
            dataKey="matchday"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 3]}
            ticks={[0, 1, 2, 3]}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Points",
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-muted)",
              fontSize: 12,
            }}
          />
          <ReferenceLine
            y={2}
            stroke="var(--text-muted)"
            strokeDasharray="6 4"
            label={{
              value: "2.0 avg",
              fill: "var(--text-muted)",
              fontSize: 11,
              position: "right",
            }}
          />
          <Tooltip content={<FormTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-xs text-[var(--text-secondary)]">
                {value}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="points"
            name={`${teamName} Points`}
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4, fill: "#3b82f6", stroke: "var(--bg-card)", strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: "#3b82f6", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="cumulativeAvg"
            name="Cumulative Avg"
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
