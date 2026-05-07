"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Database,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Key,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Shield,
  TestTube2,
  Trash2,
  Wifi,
  XCircle,
  Zap,
  Brain,
  Server,
  Cloud,
  Monitor,
} from "lucide-react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { TopBar } from "@/components/TopBar";
import {
  getApiConfigurations,
  testApiConfiguration,
  updateApiConfiguration,
  deleteApiConfiguration,
  rotateApiKey,
  type ApiConfiguration,
  type ApiProviderStatus,
} from "@/lib/api-client";

// ── Tab definitions ─────────────────────────────────────────────────

interface TabDef {
  key: string;
  label: string;
  sublabel: string;
  icon: typeof Database;
  category: string;
}

const tabs: TabDef[] = [
  {
    key: "data",
    label: "数据 APIs",
    sublabel: "Data APIs",
    icon: Database,
    category: "data_api",
  },
  {
    key: "llm",
    label: "LLM 提供商",
    sublabel: "LLM Providers",
    icon: Brain,
    category: "llm_provider",
  },
  {
    key: "obs",
    label: "OBS & Webhooks",
    sublabel: "OBS & Webhooks",
    icon: Monitor,
    category: "webhook",
  },
  {
    key: "storage",
    label: "存储",
    sublabel: "Storage",
    icon: HardDrive,
    category: "storage",
  },
  {
    key: "security",
    label: "安全",
    sublabel: "Security",
    icon: Shield,
    category: "security",
  },
];

// ── Provider presets for fallback when API returns empty ────────────

const providerPresets: Record<string, Omit<ApiConfiguration, "id">[]> = {
  data_api: [
    {
      name: "football-data.org",
      category: "data_api",
      status: "missing",
      maskedKey: null,
      baseUrl: "https://api.football-data.org/v4",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "Sportmonks",
      category: "data_api",
      status: "missing",
      maskedKey: null,
      baseUrl: "https://api.sportmonks.com/v3/football",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "API-Football",
      category: "data_api",
      status: "missing",
      maskedKey: null,
      baseUrl: "https://v3.football.api-sports.io",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "TheSports",
      category: "data_api",
      status: "missing",
      maskedKey: null,
      baseUrl: "https://api.thesports.com/v1/football",
      lastTestResult: null,
      degradedReason: null,
    },
  ],
  llm_provider: [
    {
      name: "HuggingFace",
      category: "llm_provider",
      status: "missing",
      maskedKey: null,
      baseUrl: "https://api-inference.huggingface.co",
      modelId: "meta-llama/Meta-Llama-3-8B-Instruct",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "OpenAI-compatible",
      category: "llm_provider",
      status: "missing",
      maskedKey: null,
      baseUrl: "",
      modelId: "",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "OpenAI",
      category: "llm_provider",
      status: "missing",
      maskedKey: null,
      baseUrl: "https://api.openai.com/v1",
      modelId: "gpt-4o-mini",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "Ollama",
      category: "llm_provider",
      status: "missing",
      maskedKey: null,
      baseUrl: "http://localhost:11434",
      modelId: "llama3",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "Mock",
      category: "llm_provider",
      status: "configured",
      maskedKey: null,
      baseUrl: "local",
      modelId: "deterministic-template",
      lastTestResult: null,
      degradedReason: null,
    },
  ],
  webhook: [
    {
      name: "Public App URL",
      category: "webhook",
      status: "missing",
      maskedKey: null,
      baseUrl: "",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "Browser Source Secret",
      category: "webhook",
      status: "missing",
      maskedKey: null,
      baseUrl: "",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "Webhook Secret",
      category: "webhook",
      status: "missing",
      maskedKey: null,
      baseUrl: "",
      lastTestResult: null,
      degradedReason: null,
    },
  ],
  storage: [
    {
      name: "Storage Provider",
      category: "storage",
      status: "configured",
      maskedKey: null,
      baseUrl: "local",
      lastTestResult: null,
      degradedReason: null,
      extra: { provider: "local", bucket: "", endpoint: "" },
    },
  ],
  security: [
    {
      name: "Admin Token",
      category: "security",
      status: "missing",
      maskedKey: null,
      baseUrl: "",
      lastTestResult: null,
      degradedReason: null,
    },
    {
      name: "Disclaimer Required",
      category: "security",
      status: "configured",
      maskedKey: null,
      baseUrl: "",
      lastTestResult: null,
      degradedReason: null,
      extra: { enabled: true },
    },
    {
      name: "Betting Advice Disabled",
      category: "security",
      status: "configured",
      maskedKey: null,
      baseUrl: "",
      lastTestResult: null,
      degradedReason: null,
      extra: { enabled: true },
    },
  ],
};

// ── Provider icon lookup ────────────────────────────────────────────

function providerIcon(name: string): typeof Database {
  const lower = name.toLowerCase();
  if (lower.includes("football-data") || lower.includes("api-football")) return Globe;
  if (lower.includes("sportmonk")) return Zap;
  if (lower.includes("thesports")) return Wifi;
  if (lower.includes("hugging")) return Brain;
  if (lower.includes("openai")) return Zap;
  if (lower.includes("ollama")) return Server;
  if (lower.includes("mock")) return TestTube2;
  if (lower.includes("storage") || lower.includes("s3") || lower.includes("r2")) return Cloud;
  if (lower.includes("obs") || lower.includes("browser") || lower.includes("webhook")) return Monitor;
  if (lower.includes("admin") || lower.includes("token") || lower.includes("secret")) return Key;
  if (lower.includes("disclaimer") || lower.includes("betting")) return Shield;
  return Database;
}

// ── Status badge helpers ────────────────────────────────────────────

const statusBadgeClass: Record<ApiProviderStatus, string> = {
  configured: "badge-green",
  healthy: "badge-green",
  missing: "badge-amber",
  degraded: "badge-amber",
  rate_limited: "badge-red",
  error: "badge-red",
};

const statusLabel: Record<ApiProviderStatus, { zh: string; en: string }> = {
  configured: { zh: "已配置", en: "Configured" },
  healthy: { zh: "健康", en: "Healthy" },
  missing: { zh: "未配置", en: "Missing" },
  degraded: { zh: "降级", en: "Degraded" },
  rate_limited: { zh: "限流", en: "Rate Limited" },
  error: { zh: "错误", en: "Error" },
};

// ── Main page component ─────────────────────────────────────────────

export default function ApiSettingsPage() {
  const [activeTab, setActiveTab] = useState("data");
  const [configs, setConfigs] = useState<ApiConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [rotating, setRotating] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<
    Record<string, { apiKey: string; baseUrl: string; modelId: string; extra: Record<string, unknown> }>
  >({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getApiConfigurations();
    setConfigs(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Get configs for active tab, merge with presets
  const tabDef = tabs.find((t) => t.key === activeTab)!;
  const tabConfigs = mergeWithPresets(
    configs.filter((c) => c.category === tabDef.category),
    providerPresets[tabDef.category] ?? [],
  );

  function getEdit(id: string, config: ApiConfiguration) {
    if (editValues[id]) return editValues[id];
    return {
      apiKey: "",
      baseUrl: config.baseUrl ?? "",
      modelId: config.modelId ?? "",
      extra: config.extra ?? {},
    };
  }

  function setEditField(id: string, field: string, value: unknown) {
    setEditValues((prev) => {
      const existing = prev[id] ?? { apiKey: "", baseUrl: "", modelId: "", extra: {} };
      if (field === "extra") {
        return { ...prev, [id]: { ...existing, extra: value as Record<string, unknown> } };
      }
      return { ...prev, [id]: { ...existing, [field]: value } };
    });
  }

  async function handleTest(config: ApiConfiguration) {
    if (!config.id) return;
    setTesting(config.id);
    try {
      const result = await testApiConfiguration(config.id);
      setConfigs((prev) =>
        prev.map((c) =>
          c.id === config.id
            ? { ...c, lastTestResult: result, status: result.ok ? "healthy" : "error" }
            : c,
        ),
      );
      setToast({
        message: result.ok
          ? `测试通过 (${result.latencyMs}ms)`
          : `测试失败: ${result.detail}`,
        type: result.ok ? "success" : "error",
      });
    } catch {
      setToast({ message: "测试请求失败", type: "error" });
    }
    setTesting(null);
  }

  async function handleSave(config: ApiConfiguration) {
    if (!config.id) return;
    const edit = getEdit(config.id, config);
    setSaving(config.id);
    try {
      await updateApiConfiguration(config.id, {
        apiKey: edit.apiKey || undefined,
        baseUrl: edit.baseUrl || undefined,
        modelId: edit.modelId || undefined,
        extra: Object.keys(edit.extra).length > 0 ? edit.extra : undefined,
      });
      setToast({ message: "保存成功", type: "success" });
      setEditValues((prev) => {
        const next = { ...prev };
        delete next[config.id];
        return next;
      });
      await load();
    } catch {
      setToast({ message: "保存失败", type: "error" });
    }
    setSaving(null);
  }

  async function handleDelete(config: ApiConfiguration) {
    if (!config.id) return;
    setDeleting(config.id);
    try {
      await deleteApiConfiguration(config.id);
      setToast({ message: "已删除", type: "success" });
      await load();
    } catch {
      setToast({ message: "删除失败", type: "error" });
    }
    setDeleting(null);
  }

  async function handleRotate(config: ApiConfiguration) {
    if (!config.id) return;
    setRotating(config.id);
    try {
      const result = await rotateApiKey(config.id);
      setConfigs((prev) =>
        prev.map((c) =>
          c.id === config.id ? { ...c, maskedKey: result.maskedKey } : c,
        ),
      );
      setToast({ message: "密钥已轮换", type: "success" });
    } catch {
      setToast({ message: "密钥轮换失败", type: "error" });
    }
    setRotating(null);
  }

  const configuredCount = tabConfigs.filter(
    (c) => c.status === "configured" || c.status === "healthy",
  ).length;

  return (
    <div className="min-h-screen">
      <TopBar
        title="API 配置中心"
        subtitle="API Configuration Center"
      />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed right-4 top-16 z-50 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
              toast.type === "success"
                ? "border-[var(--accent-green)] bg-emerald-500/10 text-[var(--accent-green)]"
                : "border-[var(--accent-red)] bg-red-500/10 text-[var(--accent-red)]"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
            ) : (
              <XCircle className="mr-1.5 inline h-4 w-4" />
            )}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary banner */}
      <div className="px-4 pt-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-[var(--accent-blue)]" />
              <span className="font-medium">配置概览</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-green)]" />
              <span>{configuredCount} 已配置</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Database className="h-3.5 w-3.5 text-[var(--accent-blue)]" />
              <span>{tabConfigs.length} 总计</span>
            </div>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">
            For commentary assistance, not betting advice.
          </span>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--bg-card)] text-[var(--accent-blue)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                <TabIcon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="card flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载配置...
          </div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Tab header */}
            <div className="flex items-center gap-2 text-sm font-medium">
              <tabDef.icon className="h-4 w-4 text-[var(--accent-blue)]" />
              {tabDef.label}
              <span className="text-xs text-[var(--text-muted)]">
                {tabDef.sublabel}
              </span>
            </div>

            {/* Provider cards */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {tabConfigs.map((config, index) => (
                <ProviderConfigCard
                  key={config.id ?? `preset-${index}`}
                  config={config}
                  edit={getEdit(config.id ?? `preset-${index}`, config)}
                  onEditField={(field, value) =>
                    setEditField(config.id ?? `preset-${index}`, field, value)
                  }
                  showKey={showKeys[config.id ?? `preset-${index}`] ?? false}
                  onToggleKey={() =>
                    setShowKeys((prev) => ({
                      ...prev,
                      [config.id ?? `preset-${index}`]:
                        !(prev[config.id ?? `preset-${index}`] ?? false),
                    }))
                  }
                  onTest={() => handleTest(config)}
                  onSave={() => handleSave(config)}
                  onDelete={() => handleDelete(config)}
                  onRotate={() => handleRotate(config)}
                  testing={testing === config.id}
                  saving={saving === config.id}
                  deleting={deleting === config.id}
                  rotating={rotating === config.id}
                />
              ))}
            </div>

            {/* Disclaimer */}
            {activeTab === "security" && (
              <Alert
                variant="warning"
                message="本系统仅用于解说辅助，不提供任何投注建议。 For commentary assistance, not betting advice."
              />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Provider Config Card ────────────────────────────────────────────

interface ProviderConfigCardProps {
  config: ApiConfiguration;
  edit: { apiKey: string; baseUrl: string; modelId: string; extra: Record<string, unknown> };
  onEditField: (field: string, value: unknown) => void;
  showKey: boolean;
  onToggleKey: () => void;
  onTest: () => void;
  onSave: () => void;
  onDelete: () => void;
  onRotate: () => void;
  testing: boolean;
  saving: boolean;
  deleting: boolean;
  rotating: boolean;
}

function ProviderConfigCard({
  config,
  edit,
  onEditField,
  showKey,
  onToggleKey,
  onTest,
  onSave,
  onDelete,
  onRotate,
  testing,
  saving,
  deleting,
  rotating,
}: ProviderConfigCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = providerIcon(config.name);
  const badge = statusBadgeClass[config.status] ?? "badge-amber";
  const label = statusLabel[config.status] ?? { zh: "未知", en: "Unknown" };
  const isLlm = config.category === "llm_provider";
  const isStorage = config.category === "storage";
  const isSecurity = config.category === "security";
  const hasId = Boolean(config.id);

  function copyMaskedKey() {
    if (config.maskedKey) {
      void navigator.clipboard.writeText(config.maskedKey);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover space-y-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--accent-blue)]" />
          <span className="text-sm font-medium">{config.name}</span>
        </div>
        <span className={`badge text-[10px] ${badge}`}>
          {label.zh}
        </span>
      </div>

      {/* Masked key display */}
      {config.maskedKey && (
        <div className="flex items-center gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5">
          <Key className="h-3 w-3 flex-shrink-0 text-[var(--text-muted)]" />
          <span className="flex-1 truncate font-mono text-xs text-[var(--text-secondary)]">
            {showKey ? config.maskedKey : maskKey(config.maskedKey)}
          </span>
          <button
            onClick={onToggleKey}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            title={showKey ? "隐藏" : "显示"}
          >
            {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
          <button
            onClick={copyMaskedKey}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            title="复制"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Editable fields */}
      <div className="space-y-2">
        {/* API Key input */}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={edit.apiKey}
                onChange={(e) => onEditField("apiKey", e.target.value)}
                placeholder={config.maskedKey ? "输入新密钥以更新" : "输入 API Key"}
                className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 pr-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
              />
              <button
                onClick={onToggleKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
            {hasId && (
              <Button
                onClick={onRotate}
                loading={rotating}
                variant="secondary"
                size="sm"
                icon={<RefreshCw className="h-3 w-3" />}
                title="轮换密钥"
              >
                轮换
              </Button>
            )}
          </div>
        </div>

        {/* Base URL */}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
            Base URL
          </label>
          <input
            type="text"
            value={edit.baseUrl}
            onChange={(e) => onEditField("baseUrl", e.target.value)}
            placeholder="https://api.example.com"
            className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
          />
        </div>

        {/* Model ID (LLM providers) */}
        {isLlm && (
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              Model ID
            </label>
            <input
              type="text"
              value={edit.modelId}
              onChange={(e) => onEditField("modelId", e.target.value)}
              placeholder="e.g. gpt-4o-mini"
              className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>
        )}

        {/* Storage extra fields */}
        {isStorage && (
          <StorageExtraFields extra={edit.extra} onChange={(val) => onEditField("extra", val)} />
        )}

        {/* Security toggles */}
        {isSecurity && config.name !== "Admin Token" && (
          <SecurityToggle
            name={config.name}
            enabled={Boolean(edit.extra?.enabled)}
            onChange={(val) => onEditField("extra", { ...edit.extra, enabled: val })}
          />
        )}
      </div>

      {/* Degraded reason */}
      {config.degradedReason && (
        <div className="flex items-start gap-1.5 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-[var(--accent-amber)]">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>{config.degradedReason}</span>
        </div>
      )}

      {/* Last test result */}
      {config.lastTestResult && (
        <div
          className={`flex items-start gap-1.5 rounded px-3 py-2 text-[10px] ${
            config.lastTestResult.ok
              ? "bg-emerald-500/10 text-[var(--accent-green)]"
              : "bg-red-500/10 text-[var(--accent-red)]"
          }`}
        >
          {config.lastTestResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <span>
              {config.lastTestResult.ok
                ? `测试通过 (${config.lastTestResult.latencyMs}ms)`
                : `测试失败: ${config.lastTestResult.detail}`}
            </span>
            <span className="ml-2 text-[var(--text-muted)]">
              {config.lastTestResult.testedAt
                ? new Date(config.lastTestResult.testedAt).toLocaleString("zh-CN")
                : ""}
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between border-t border-[var(--border-color)] pt-3">
        <div className="flex items-center gap-2">
          {hasId && (
            <Button
              onClick={onTest}
              loading={testing}
              variant="secondary"
              size="sm"
              icon={<TestTube2 className="h-3 w-3" />}
            >
              {testing ? "测试中..." : "测试连接"}
            </Button>
          )}
          <Button
            onClick={onSave}
            loading={saving}
            disabled={!hasId}
            variant="ghost"
            size="sm"
            icon={<Save className="h-3 w-3" />}
            className="bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/25"
          >
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
        {hasId && (
          <Button
            onClick={onDelete}
            loading={deleting}
            variant="danger"
            size="sm"
            icon={<Trash2 className="h-3 w-3" />}
          >
            {deleting ? "删除中..." : "删除"}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ── Storage extra fields ────────────────────────────────────────────

function StorageExtraFields({
  extra,
  onChange,
}: {
  extra: Record<string, unknown>;
  onChange: (val: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          存储类型 / Storage Provider
        </label>
        <select
          value={(extra.provider as string) ?? "local"}
          onChange={(e) => onChange({ ...extra, provider: e.target.value })}
          className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
        >
          <option value="local">本地 / Local</option>
          <option value="s3">Amazon S3</option>
          <option value="r2">Cloudflare R2</option>
        </select>
      </div>
      {(extra.provider === "s3" || extra.provider === "r2") && (
        <>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              Bucket
            </label>
            <input
              type="text"
              value={(extra.bucket as string) ?? ""}
              onChange={(e) => onChange({ ...extra, bucket: e.target.value })}
              placeholder="my-bucket"
              className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              Endpoint
            </label>
            <input
              type="text"
              value={(extra.endpoint as string) ?? ""}
              onChange={(e) => onChange({ ...extra, endpoint: e.target.value })}
              placeholder="https://s3.amazonaws.com"
              className="w-full rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Security toggle ─────────────────────────────────────────────────

function SecurityToggle({
  name,
  enabled,
  onChange,
}: {
  name: string;
  enabled: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2">
      <span className="text-xs text-[var(--text-secondary)]">{name}</span>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative h-5 w-9 rounded-full transition-colors ${
          enabled ? "bg-[var(--accent-green)]" : "bg-[var(--border-color)]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "****";
  return key.slice(0, 3) + "****" + key.slice(-4);
}

function mergeWithPresets(
  apiConfigs: ApiConfiguration[],
  presets: Omit<ApiConfiguration, "id">[],
): ApiConfiguration[] {
  const result: ApiConfiguration[] = [...apiConfigs];
  const existingNames = new Set(apiConfigs.map((c) => c.name.toLowerCase()));

  for (const preset of presets) {
    if (!existingNames.has(preset.name.toLowerCase())) {
      result.push({ ...preset, id: "" });
    }
  }

  return result;
}
