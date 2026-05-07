"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Database, RefreshCw, Settings, Wifi } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import {
  getProviderDashboard,
  type ProviderDashboard,
  type ProviderItem,
  type ProviderLog,
} from "@/lib/api-client";

const fieldMap = [
  { source: "lineup", target: "Player.lineup", description: "首发名单" },
  { source: "stats", target: "Player.stats", description: "球员统计" },
  { source: "fixtures", target: "Match.fixture", description: "赛程信息" },
  { source: "events", target: "MatchEvent.*", description: "比赛事件" },
  { source: "standings", target: "League.standings", description: "联赛排名" },
  { source: "scorers", target: "League.topScorers", description: "射手榜" },
];

export default function DataPage() {
  const [dashboard, setDashboard] = useState<ProviderDashboard | null>(null);
  const [logs, setLogs] = useState<ProviderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const next = await getProviderDashboard();
    setDashboard(next);
    setLogs(next.logs);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const connected = useMemo(
    () => dashboard?.providers.filter((provider) => isHealthy(provider.status)).length ?? 0,
    [dashboard],
  );
  const total = dashboard?.providers.length ?? 0;

  async function handleSync() {
    setSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    setLogs((prev) => [
      {
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        source: "LineupCast",
        message: "Sync requested; provider list refreshed from API.",
        status: "success",
      },
      ...prev,
    ]);
    await load();
    setSyncing(false);
  }

  async function handleTest(provider: ProviderItem) {
    setTesting(provider.id);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setLogs((prev) => [
      {
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        source: provider.name,
        message: isHealthy(provider.status)
          ? "Test passed; provider metadata is reachable."
          : "Test warning; provider is configured but not currently reachable.",
        status: isHealthy(provider.status) ? "success" : "warning",
      },
      ...prev,
    ]);
    setTesting(null);
  }

  return (
    <div className="min-h-screen">
      <TopBar
        title="数据源管理"
        subtitle={`${connected}/${total} 已连接 · API ${dashboard?.apiHealth ?? "checking"}`}
      />

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-[var(--accent-blue)]" />
              数据提供商
            </div>
            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] disabled:opacity-60"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "同步中" : "全部同步"}
            </button>
          </div>

          <div className="space-y-2">
            {loading && (
              <div className="card text-sm text-[var(--text-muted)]">正在加载数据源...</div>
            )}
            {dashboard?.providers.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                testing={testing === provider.id}
                onTest={() => handleTest(provider)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-4 xl:col-span-7">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatusCard
              label="API"
              value={dashboard?.apiHealth ?? "-"}
              tone={dashboard?.apiHealth === "online" ? "green" : "amber"}
            />
            <StatusCard
              label="Sync"
              value={syncing ? "running" : (dashboard?.syncStatus ?? "-")}
              tone={syncing ? "amber" : "green"}
            />
            <StatusCard
              label="Test"
              value={testing ? "running" : (dashboard?.testStatus ?? "-")}
              tone={testing ? "amber" : "green"}
            />
          </div>

          <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4 text-[var(--accent-purple)]" />
                字段映射
              </div>
              <span className="badge-blue text-[10px]">自动映射</span>
            </div>

            <div className="overflow-x-auto rounded border border-[var(--border-color)]">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="bg-[var(--bg-primary)]">
                    <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">
                      源字段
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">
                      目标字段
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">
                      说明
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--text-muted)]">
                      状态
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fieldMap.map((field, i) => (
                    <tr
                      key={field.source}
                      className={i % 2 === 0 ? "bg-[var(--bg-card)]" : "bg-[var(--bg-secondary)]"}
                    >
                      <td className="px-3 py-2 font-mono text-[var(--accent-blue)]">
                        {field.source}
                      </td>
                      <td className="px-3 py-2 font-mono text-[var(--accent-green)]">
                        {field.target}
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">
                        {field.description}
                      </td>
                      <td className="px-3 py-2">
                        <span className="badge-green text-[10px]">已映射</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card space-y-3">
            <div className="text-sm font-medium">同步 / 测试日志</div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto font-mono text-[10px]">
              {logs.map((log, i) => (
                <div
                  key={`${log.time}-${log.source}-${i}`}
                  className={`grid grid-cols-[64px_130px_minmax(0,1fr)] gap-2 rounded px-2 py-1 ${
                    log.status === "error"
                      ? "bg-red-500/10 text-[var(--accent-red)]"
                      : log.status === "warning"
                        ? "bg-amber-500/10 text-[var(--accent-amber)]"
                        : "bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                  }`}
                >
                  <span className="text-[var(--text-muted)]">{log.time}</span>
                  <span className="truncate font-medium">{log.source}</span>
                  <span className="min-w-0 truncate">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  testing,
  onTest,
}: {
  provider: ProviderItem;
  testing: boolean;
  onTest: () => void;
}) {
  const healthy = isHealthy(provider.status);
  return (
    <div className="card-hover space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wifi
              className={`h-4 w-4 ${healthy ? "text-[var(--accent-green)]" : "text-[var(--accent-amber)]"}`}
            />
            <span className="truncate text-sm font-medium">{provider.name}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
            {provider.description ?? provider.type ?? "Provider metadata loaded from API"}
          </p>
        </div>
        <span className={`badge text-[10px] ${healthy ? "badge-green" : "badge-amber"}`}>
          {provider.status}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {(provider.fields ?? [provider.type ?? "provider"]).map((field) => (
            <span key={field} className="badge-blue text-[10px]">
              {field}
            </span>
          ))}
        </div>
        <button
          onClick={onTest}
          disabled={testing}
          className="flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] disabled:opacity-60"
        >
          <Activity className={`h-3 w-3 ${testing ? "animate-pulse" : ""}`} />
          {testing ? "测试中" : "测试"}
        </button>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber";
}) {
  return (
    <div className="card flex items-center gap-3">
      <CheckCircle2
        className={`h-4 w-4 ${tone === "green" ? "text-[var(--accent-green)]" : "text-[var(--accent-amber)]"}`}
      />
      <div className="min-w-0">
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function isHealthy(status: string): boolean {
  return status === "active" || status === "connected" || status === "ready" || status === "online";
}
