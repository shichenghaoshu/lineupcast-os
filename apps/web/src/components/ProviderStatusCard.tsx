"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { DataProvider } from "@/lib/types";

interface ProviderStatusCardProps {
  provider: DataProvider;
  onTest?: () => void;
  testing?: boolean;
}

const statusConfig = {
  connected: {
    icon: Wifi,
    label: "已连接",
    color: "text-[var(--accent-green)]",
    bg: "bg-emerald-500/10",
  },
  disconnected: {
    icon: WifiOff,
    label: "未连接",
    color: "text-[var(--text-muted)]",
    bg: "bg-[var(--bg-primary)]",
  },
  error: {
    icon: AlertTriangle,
    label: "错误",
    color: "text-[var(--accent-red)]",
    bg: "bg-red-500/10",
  },
};

const healthConfig = {
  healthy: {
    label: "健康",
    color: "text-[var(--accent-green)]",
    dot: "bg-[var(--accent-green)]",
  },
  degraded: {
    label: "降级",
    color: "text-[var(--accent-amber)]",
    dot: "bg-[var(--accent-amber)]",
  },
  unhealthy: {
    label: "异常",
    color: "text-[var(--accent-red)]",
    dot: "bg-[var(--accent-red)]",
  },
};

export function ProviderStatusCard({
  provider,
  onTest,
  testing,
}: ProviderStatusCardProps) {
  const config = statusConfig[provider.status] ?? statusConfig.disconnected;
  const Icon = config.icon;
  const health = provider.health ?? "healthy";
  const healthCfg = healthConfig[health];
  const errorCount = provider.errorCount ?? 0;
  const [errorExpanded, setErrorExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover space-y-3"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className="text-sm font-medium">{provider.name}</span>
          {/* Health dot */}
          <span
            className={`inline-block h-2 w-2 rounded-full ${healthCfg.dot}`}
            title={healthCfg.label}
          />
        </div>
        <div className="flex items-center gap-2">
          {/* Freshness badge */}
          {provider.freshness && (
            <span
              className={`text-[10px] ${
                provider.freshness === "never"
                  ? "text-[var(--text-muted)]"
                  : provider.freshness === "just now"
                    ? "text-[var(--accent-green)]"
                    : provider.freshness.endsWith("ago")
                      ? "text-[var(--accent-blue)]"
                      : "text-[var(--accent-amber)]"
              }`}
            >
              {provider.freshness}
            </span>
          )}
          {/* Error count badge */}
          {errorCount > 0 && (
            <span className="badge-red text-[10px]">
              {errorCount} 错误
            </span>
          )}
          <span
            className={`badge text-[10px] ${
              provider.status === "connected"
                ? "badge-green"
                : provider.status === "error"
                  ? "badge-red"
                  : "bg-[var(--bg-primary)] text-[var(--text-muted)]"
            }`}
          >
            {config.label}
          </span>
        </div>
      </div>

      {/* Fields */}
      <div className="flex flex-wrap gap-1">
        {provider.fields.map((field) => (
          <span key={field} className="badge-blue text-[10px]">
            {field}
          </span>
        ))}
      </div>

      {/* Last successful sync */}
      {provider.lastSuccessfulSync && (
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <Clock className="h-3 w-3" />
          上次成功同步:{" "}
          {new Date(provider.lastSuccessfulSync).toLocaleString("zh-CN")}
        </div>
      )}

      {/* Last error message (expandable) */}
      {provider.lastError && (
        <div className="rounded border border-red-500/20 bg-red-500/5 p-2">
          <button
            onClick={() => setErrorExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between gap-2 text-left text-[10px] text-[var(--accent-red)]"
          >
            <span className="flex items-center gap-1 truncate">
              <XCircle className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {errorExpanded ? "最近错误" : truncateError(provider.lastError)}
              </span>
            </span>
            {provider.lastError.length > 60 &&
              (errorExpanded ? (
                <ChevronUp className="h-3 w-3 flex-shrink-0" />
              ) : (
                <ChevronDown className="h-3 w-3 flex-shrink-0" />
              ))}
          </button>
          <AnimatePresence>
            {errorExpanded && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-1.5 overflow-hidden text-[10px] text-[var(--text-muted)]"
              >
                {provider.lastError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Health indicator + Test button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px]">
          <CheckCircle2 className={`h-3 w-3 ${healthCfg.color}`} />
          <span className={healthCfg.color}>{healthCfg.label}</span>
        </div>
        {onTest && (
          <button
            onClick={onTest}
            disabled={testing}
            className="flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] disabled:opacity-60"
          >
            {testing ? "测试中..." : "测试连接"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function truncateError(error: string, maxLen = 60): string {
  if (error.length <= maxLen) return error;
  return error.slice(0, maxLen) + "...";
}
