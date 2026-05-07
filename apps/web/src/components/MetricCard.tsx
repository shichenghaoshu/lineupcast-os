"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: "blue" | "green" | "purple" | "amber" | "red";
  subtitle?: string;
}

const colorMap = {
  blue: "text-[var(--accent-blue)]",
  green: "text-[var(--accent-green)]",
  purple: "text-[var(--accent-purple)]",
  amber: "text-[var(--accent-amber)]",
  red: "text-[var(--accent-red)]",
};

export const MetricCard = memo(function MetricCard({
  label,
  value,
  icon,
  color = "blue",
  subtitle,
}: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover flex items-center gap-2 sm:gap-3 min-w-0"
    >
      {icon && (
        <div className={`rounded-md bg-[var(--bg-primary)] p-1.5 sm:p-2 flex-shrink-0 ${colorMap[color]}`}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="metric-label truncate">{label}</div>
        <div className={`metric-value ${colorMap[color]}`}>{value}</div>
        {subtitle && (
          <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>
        )}
      </div>
    </motion.div>
  );
});
