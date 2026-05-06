"use client";

import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import type { DataProvider } from "@/lib/types";

interface ProviderStatusCardProps {
  provider: DataProvider;
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

export function ProviderStatusCard({ provider }: ProviderStatusCardProps) {
  const config = statusConfig[provider.status];
  const Icon = config.icon;

  return (
    <div className="card-hover space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color}`} />
          <span className="text-sm font-medium">{provider.name}</span>
        </div>
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
      <div className="flex flex-wrap gap-1">
        {provider.fields.map((field) => (
          <span key={field} className="badge-blue text-[10px]">
            {field}
          </span>
        ))}
      </div>
      {provider.lastSync && (
        <div className="text-[10px] text-[var(--text-muted)]">
          上次同步: {new Date(provider.lastSync).toLocaleString("zh-CN")}
        </div>
      )}
    </div>
  );
}
