"use client";

import { memo, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface CardRiskEntry {
  player: string;
  foulsPer90: number;
  cardsPer90: number;
  minutesPlayed: number;
  position: string;
}

interface CardRiskHeatmapProps {
  data: CardRiskEntry[];
  className?: string;
}

const POSITION_COLORS: Record<string, string> = {
  GK: "#f59e0b",
  DEF: "#3b82f6",
  MID: "#10b981",
  FWD: "#ef4444",
};

function getRiskZone(cards: number): "low" | "medium" | "high" {
  if (cards >= 0.3) return "high";
  if (cards >= 0.15) return "medium";
  return "low";
}

function RiskTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CardRiskEntry }>;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0].payload;
  const zone = getRiskZone(entry.cardsPer90);

  return (
    <div className="card px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 font-semibold text-[var(--text-primary)]">
        {entry.player}
      </div>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-secondary)]">Position:</span>
          <span
            className="badge text-xs"
            style={{
              backgroundColor:
                (POSITION_COLORS[entry.position] ?? "#6b7280") + "33",
              color: POSITION_COLORS[entry.position] ?? "#6b7280",
            }}
          >
            {entry.position}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">Fouls/90: </span>
          <span className="font-medium text-[var(--text-primary)]">
            {entry.foulsPer90.toFixed(1)}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">Cards/90: </span>
          <span className="font-medium text-[var(--text-primary)]">
            {entry.cardsPer90.toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">Minutes: </span>
          <span className="font-medium text-[var(--text-primary)]">
            {entry.minutesPlayed}
          </span>
        </div>
        <div className="mt-1">
          <span
            className="badge text-xs font-bold"
            style={{
              backgroundColor:
                zone === "high"
                  ? "#ef444433"
                  : zone === "medium"
                    ? "#f59e0b33"
                    : "#10b98133",
              color:
                zone === "high"
                  ? "#ef4444"
                  : zone === "medium"
                    ? "#f59e0b"
                    : "#10b981",
            }}
          >
            {zone.toUpperCase()} RISK
          </span>
        </div>
      </div>
    </div>
  );
}

export const CardRiskHeatmap = memo(function CardRiskHeatmap({
  data,
  className = "",
}: CardRiskHeatmapProps) {
  // Group data by position for separate scatter series
  const grouped = useMemo(() => {
    const positions = Array.from(new Set(data.map((d) => d.position)));
    return positions.map((pos) => ({
      position: pos,
      entries: data.filter((d) => d.position === pos),
    }));
  }, [data]);

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-color)"
          />
          <XAxis
            dataKey="foulsPer90"
            name="Fouls/90"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--border-color)" }}
            tickLine={false}
            label={{
              value: "Fouls per 90",
              position: "insideBottom",
              offset: -2,
              fill: "var(--text-muted)",
              fontSize: 12,
            }}
          />
          <YAxis
            dataKey="cardsPer90"
            name="Cards/90"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{
              value: "Cards per 90",
              angle: -90,
              position: "insideLeft",
              fill: "var(--text-muted)",
              fontSize: 12,
            }}
          />
          <ZAxis
            dataKey="minutesPlayed"
            range={[40, 300]}
            name="Minutes"
          />
          <Tooltip content={<RiskTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            formatter={(value: string) => (
              <span className="text-xs text-[var(--text-secondary)]">
                {value}
              </span>
            )}
          />
          {grouped.map((group) => (
            <Scatter
              key={group.position}
              name={group.position}
              data={group.entries}
              fill={POSITION_COLORS[group.position] ?? "#6b7280"}
              fillOpacity={0.8}
              stroke="var(--bg-card)"
              strokeWidth={1}
            >
              {group.entries.map((entry, j) => (
                <Cell
                  key={j}
                  fill={
                    getRiskZone(entry.cardsPer90) === "high"
                      ? "#ef4444"
                      : getRiskZone(entry.cardsPer90) === "medium"
                        ? "#f59e0b"
                        : POSITION_COLORS[entry.position] ?? "#6b7280"
                  }
                />
              ))}
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Risk zone legend */}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="text-[var(--text-secondary)]">Low Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="text-[var(--text-secondary)]">Medium Risk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-[var(--text-secondary)]">High Risk</span>
        </div>
      </div>
    </div>
  );
});
