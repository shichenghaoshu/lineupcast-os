"use client";

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

export function MetricCard({
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
      className="card-hover flex items-center gap-3"
    >
      {icon && (
        <div className={`rounded-md bg-[var(--bg-primary)] p-2 ${colorMap[color]}`}>
          {icon}
        </div>
      )}
      <div>
        <div className="metric-label">{label}</div>
        <div className={`metric-value ${colorMap[color]}`}>{value}</div>
        {subtitle && (
          <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>
        )}
      </div>
    </motion.div>
  );
}
