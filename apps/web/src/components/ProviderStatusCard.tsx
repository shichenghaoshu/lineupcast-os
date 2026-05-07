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
  Key,
  Gauge,
  Layers,
  TrendingUp,
  Info,
} from "lucide-react";
import type { DataProvider, SyncOutcome } from "@/lib/types";

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

const trendConfig: Record<SyncOutcome, { color: string; label: string }> = {
  success: { color: "bg-[var(--accent-green)]", label: "成功" },
  error: { color: "bg-[var(--accent-red)]", label: "失败" },
  timeout: { color: "bg-[var(--accent-amber)]", label: "超时" },
  skipped: { color: "bg-[var(--bg-primary)]", label: "跳过" },
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
  const [showDegradedTooltip, setShowDegradedTooltip] = useState(false);

  const rateLimitRemaining = provider.rateLimitRemaining;
  const rateLimitTotal = provider.rateLimitTotal;
  const rateLimitLow =
    rateLimitRemaining !== null &&
    rateLimitRemaining !== undefined &&
    rateLimitTotal !== null &&
    rateLimitTotal !== undefined &&
    rateLimitTotal > 0 &&
    rateLimitRemaining / rateLimitTotal < 0.2;

  const degradedReasons = provider.degradedReasons ?? [];

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
          {/* Token missing indicator */}
          {provider.tokenMissing && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-[var(--accent-amber)]"
              title={provider.tokenEnvKey ? `需要配置 ${provider.tokenEnvKey}` : "缺少 API Token"}
            >
              <Key className="h-2.5 w-2.5" />
              Token 缺失
            </span>
          )}
          {/* Degraded reason indicator */}
          {degradedReasons.length > 0 && (
            <span className="relative">
              <button
                className="inline-flex items-center gap-0.5 text-[var(--accent-amber)]"
                onMouseEnter={() => setShowDegradedTooltip(true)}
                onMouseLeave={() => setShowDegradedTooltip(false)}
                onClick={() => setShowDegradedTooltip((v) => !v)}
              >
                <Info className="h-3 w-3" />
              </button>
              <AnimatePresence>
                {showDegradedTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute left-0 top-6 z-50 w-56 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2 text-[10px] shadow-lg"
                  >
                    <div className="mb-1 font-medium text-[var(--accent-amber)]">
                      降级原因
                    </div>
                    <ul className="space-y-0.5 text-[var(--text-muted)]">
                      {degradedReasons.map((reason, i) => (
                        <li key={i} className="flex items-start gap-1">
                          <span className="mt-0.5 text-[var(--accent-amber)]">
                            -
                          </span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </span>
          )}
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

      {/* Capabilities list */}
      {provider.capabilities && provider.capabilities.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <Layers className="h-3 w-3" />
            <span>能力</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {provider.capabilities.map((cap) => (
              <span key={cap} className="rounded bg-[var(--accent-purple)]/10 px-1.5 py-0.5 text-[9px] text-[var(--accent-purple)]">
                {cap}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fields */}
      <div className="flex flex-wrap gap-1">
        {provider.fields.map((field) => (
          <span key={field} className="badge-blue text-[10px]">
            {field}
          </span>
        ))}
      </div>

      {/* Rate limit indicator */}
      {rateLimitRemaining !== null && rateLimitRemaining !== undefined && (
        <div className="flex items-center gap-2 text-[10px]">
          <Gauge className={`h-3 w-3 ${rateLimitLow ? "text-[var(--accent-amber)]" : "text-[var(--text-muted)]"}`} />
          <span className={rateLimitLow ? "text-[var(--accent-amber)]" : "text-[var(--text-muted)]"}>
            额度: {rateLimitRemaining}/{rateLimitTotal}
          </span>
          {rateLimitTotal && rateLimitTotal > 0 && (
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bg-primary)]">
              <div
                className={`h-full rounded-full transition-all ${
                  rateLimitLow ? "bg-[var(--accent-amber)]" : "bg-[var(--accent-green)]"
                }`}
                style={{ width: `${Math.round((rateLimitRemaining / rateLimitTotal) * 100)}%` }}
              />
            </div>
          )}
          {rateLimitLow && (
            <span className="text-[var(--accent-amber)]">额度不足</span>
          )}
        </div>
      )}

      {/* Last successful sync */}
      {provider.lastSuccessfulSync && (
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <Clock className="h-3 w-3" />
          上次成功同步:{" "}
          {new Date(provider.lastSuccessfulSync).toLocaleString("zh-CN")}
        </div>
      )}

      {/* Health trend (last 5 syncs) */}
      {provider.healthTrend && provider.healthTrend.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px]">
          <TrendingUp className="h-3 w-3 text-[var(--text-muted)]" />
          <span className="text-[var(--text-muted)]">趋势:</span>
          <div className="flex items-center gap-0.5">
            {provider.healthTrend.map((outcome, i) => {
              const tc = trendConfig[outcome];
              return (
                <span
                  key={i}
                  className={`inline-block h-2.5 w-2.5 rounded-sm ${tc.color}`}
                  title={tc.label}
                />
              );
            })}
          </div>
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
