"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Settings,
  Wifi,
  XCircle,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { ProviderStatusCard } from "@/components/ProviderStatusCard";
import {
  getProviderDashboard,
  getReadiness,
  testProviderConnection,
  type ProviderDashboard,
  type ProviderItem,
  type ProviderLog,
  type ReadinessData,
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
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [logs, setLogs] = useState<ProviderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; latencyMs: number; detail: string }>
  >({});

  async function load() {
    setLoading(true);
    const [next, ready] = await Promise.all([
      getProviderDashboard(),
      getReadiness(),
    ]);
    setDashboard(next);
    setLogs(next.logs);
    setReadiness(ready);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const connected = useMemo(
    () =>
      dashboard?.providers.filter((provider) => isHealthy(provider.status))
        .length ?? 0,
    [dashboard],
  );
  const total = dashboard?.providers.length ?? 0;

  // Derive health counts from readiness data
  const healthyCount = useMemo(
    () =>
      readiness?.providers.filter((p) => p.health === "healthy").length ??
      connected,
    [readiness, connected],
  );
  const errorCount = readiness?.errorCount ?? 0;
  const hasErrors = errorCount > 0;

  // Collect error logs from providers
  const errorLogs = useMemo(() => {
    return logs.filter((log) => log.status === "error");
  }, [logs]);

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
    const result = await testProviderConnection(provider.id);
    setTestResults((prev) => ({ ...prev, [provider.id]: result }));
    setLogs((prev) => [
      {
        time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        source: provider.name,
        message: result.ok
          ? `Test passed (${result.latencyMs}ms); ${result.detail}`
          : `Test failed: ${result.detail}`,
        status: result.ok ? "success" : "error",
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

      {/* Summary banner */}
      <div className="px-4 pt-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`card flex items-center justify-between gap-4 ${
            hasErrors
              ? "border-[var(--accent-amber)]"
              : "border-[var(--accent-green)]"
          }`}
        >
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[var(--accent-blue)]" />
              <span className="font-medium">提供商概览</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-green)]" />
              <span>
                {healthyCount} 健康
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Wifi className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
              <span>{total} 总计</span>
            </div>
            {hasErrors && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--accent-red)]">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{errorCount} 错误</span>
              </div>
            )}
          </div>
          {readiness && (
            <span
              className={`badge text-[10px] ${
                readiness.status === "ready" ? "badge-green" : "badge-amber"
              }`}
            >
              API {readiness.status === "ready" ? "就绪" : "降级"}
            </span>
          )}
        </motion.div>
      </div>

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
              <RefreshCw
                className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "同步中" : "全部同步"}
            </button>
          </div>

          <div className="space-y-2">
            {loading && (
              <div className="card text-sm text-[var(--text-muted)]">
                正在加载数据源...
              </div>
            )}
            {dashboard?.providers.map((provider) => {
              // Enrich provider with readiness error data
              const readyInfo = readiness?.providers.find(
                (rp) => rp.id === provider.id,
              );
              const enriched: ProviderItem = {
                ...provider,
                errorCount: readyInfo?.errorCount ?? provider.errorCount ?? 0,
                lastError:
                  readyInfo?.lastError ?? provider.lastError ?? null,
                lastSuccessfulSync:
                  readyInfo?.lastSuccessfulSync ??
                  provider.lastSuccessfulSync ??
                  null,
                freshness: readyInfo?.freshness ?? provider.freshness ?? "unknown",
                health: readyInfo?.health ?? provider.health ?? "healthy",
              };

              return (
                <div key={provider.id} className="space-y-1">
                  <ProviderStatusCard
                    provider={{
                      id: enriched.id,
                      name: enriched.name,
                      status: mapProviderStatus(enriched.status),
                      lastSync: enriched.lastSync ?? null,
                      fields:
                        enriched.fields ?? [
                          enriched.type ?? "provider",
                        ],
                      errorCount: enriched.errorCount,
                      lastError: enriched.lastError,
                      lastSuccessfulSync: enriched.lastSuccessfulSync,
                      freshness: enriched.freshness,
                      health: enriched.health,
                    }}
                    onTest={() => handleTest(provider)}
                    testing={testing === provider.id}
                  />
                  {/* Test result display */}
                  <AnimatePresence>
                    {testResults[provider.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div
                          className={`rounded px-3 py-1.5 text-[10px] ${
                            testResults[provider.id].ok
                              ? "bg-emerald-500/10 text-[var(--accent-green)]"
                              : "bg-red-500/10 text-[var(--accent-red)]"
                          }`}
                        >
                          {testResults[provider.id].ok
                            ? `✓ ${testResults[provider.id].latencyMs}ms - ${testResults[provider.id].detail}`
                            : `✗ ${testResults[provider.id].detail}`}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
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
                      className={
                        i % 2 === 0
                          ? "bg-[var(--bg-card)]"
                          : "bg-[var(--bg-secondary)]"
                      }
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

          {/* Sync / Test logs */}
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

          {/* Error Log section */}
          {errorLogs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card space-y-3 border-[var(--accent-red)]"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-[var(--accent-red)]" />
                错误日志
                <span className="badge-red text-[10px]">
                  {errorLogs.length}
                </span>
              </div>
              <div className="max-h-48 space-y-1.5 overflow-y-auto font-mono text-[10px]">
                {errorLogs.map((log, i) => (
                  <div
                    key={`err-${log.source}-${i}`}
                    className="flex items-start gap-2 rounded bg-red-500/10 px-2 py-1.5 text-[var(--accent-red)]"
                  >
                    <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="mr-2 font-medium">{log.source}</span>
                      <span className="text-[var(--text-muted)]">
                        {log.time}
                      </span>
                      <p className="mt-0.5 text-[var(--text-secondary)]">
                        {log.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
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
        className={`h-4 w-4 ${
          tone === "green"
            ? "text-[var(--accent-green)]"
            : "text-[var(--accent-amber)]"
        }`}
      />
      <div className="min-w-0">
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function isHealthy(status: string): boolean {
  return (
    status === "active" ||
    status === "connected" ||
    status === "ready" ||
    status === "online"
  );
}

function mapProviderStatus(
  status: string,
): "connected" | "disconnected" | "error" {
  if (status === "active" || status === "connected") return "connected";
  if (status === "error") return "error";
  return "disconnected";
}
