"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Key,
  Loader2,
  Pencil,
  Plus,
  Save,
  Shield,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { TopBar } from "@/components/TopBar";
import {
  listWorkspaces,
  updateWorkspace,
  getWorkspaceMembers,
  getWorkspaceUsage,
  getWorkspaceApiKeys,
  createWorkspaceApiKey,
  deleteWorkspaceApiKey,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceUsage,
  type WorkspaceApiKey,
} from "@/lib/api-client";

// ── Main page component ─────────────────────────────────────────────

export default function WorkspaceSettingsPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [apiKeys, setApiKeys] = useState<WorkspaceApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit workspace name
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Create API key
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);

  // Delete API key
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // UI state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const workspaces = await listWorkspaces();
    const ws = workspaces[0] ?? null;
    setWorkspace(ws);
    if (ws) {
      setNameValue(ws.name);
      const [m, u, k] = await Promise.all([
        getWorkspaceMembers(ws.workspaceId),
        getWorkspaceUsage(ws.workspaceId),
        getWorkspaceApiKeys(ws.workspaceId),
      ]);
      setMembers(m);
      setUsage(u);
      setApiKeys(k);
    }
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

  async function handleSaveName() {
    if (!workspace || !nameValue.trim()) return;
    setSavingName(true);
    try {
      const updated = await updateWorkspace(workspace.workspaceId, nameValue.trim());
      setWorkspace(updated);
      setEditingName(false);
      setToast({ message: "Workspace name updated", type: "success" });
    } catch {
      setToast({ message: "Failed to update workspace name", type: "error" });
    }
    setSavingName(false);
  }

  async function handleCreateKey() {
    if (!workspace || !newKeyName.trim()) return;
    setCreatingKey(true);
    try {
      const result = await createWorkspaceApiKey(workspace.workspaceId, newKeyName.trim());
      setNewKeyRaw(result.rawKey);
      setNewKeyName("");
      setShowCreateKey(false);
      setApiKeys((prev) => [result.key, ...prev]);
      setToast({ message: "API key created. Copy it now - it won't be shown again.", type: "success" });
    } catch {
      setToast({ message: "Failed to create API key", type: "error" });
    }
    setCreatingKey(false);
  }

  async function handleDeleteKey(keyId: string) {
    if (!workspace) return;
    setDeletingKey(keyId);
    try {
      await deleteWorkspaceApiKey(workspace.workspaceId, keyId);
      setApiKeys((prev) => prev.filter((k) => k.keyId !== keyId));
      setToast({ message: "API key deleted", type: "success" });
    } catch {
      setToast({ message: "Failed to delete API key", type: "error" });
    }
    setDeletingKey(null);
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text);
    setToast({ message: "Copied to clipboard", type: "success" });
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <TopBar title="工作区设置" subtitle="Workspace Settings" />
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-blue)]" />
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen">
        <TopBar title="工作区设置" subtitle="Workspace Settings" />
        <div className="p-6">
          <div className="card text-center text-sm text-[var(--text-muted)]">
            No workspace found. Please create one first.
          </div>
        </div>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    owner: "badge-green",
    admin: "badge-blue",
    member: "badge-amber",
  };

  return (
    <div className="min-h-screen">
      <TopBar title="工作区设置" subtitle="Workspace Settings" />

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

      <div className="space-y-6 p-4 sm:p-6">
        {/* ── Workspace Name ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Building2 className="h-4 w-4 text-[var(--accent-blue)]" />
            工作区信息
            <span className="text-xs text-[var(--text-muted)]">Workspace Info</span>
          </div>

          <div className="flex items-center gap-3">
            {editingName ? (
              <div className="flex flex-1 items-center gap-2">
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !nameValue.trim()}
                  className="flex items-center gap-1 rounded bg-[var(--accent-blue)]/15 px-3 py-1.5 text-xs text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)]/25 disabled:opacity-60"
                >
                  <Save className={`h-3 w-3 ${savingName ? "animate-spin" : ""}`} />
                  {savingName ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNameValue(workspace.name);
                  }}
                  className="rounded px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-1 items-center gap-3">
                <div>
                  <h2 className="text-base font-semibold">{workspace.name}</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    slug: {workspace.slug}
                  </p>
                </div>
                <button
                  onClick={() => setEditingName(true)}
                  className="ml-auto flex items-center gap-1 rounded border border-[var(--border-color)] px-2.5 py-1.5 text-[10px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)]"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
            <span>
              Workspace ID:{" "}
              <span className="font-mono text-[var(--text-secondary)]">
                {workspace.workspaceId}
              </span>
            </span>
            <span>
              Created:{" "}
              {new Date(workspace.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </div>
        </motion.div>

        {/* ── Members ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="card space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-[var(--accent-blue)]" />
              成员管理
              <span className="text-xs text-[var(--text-muted)]">
                Members ({members.length})
              </span>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-color)]">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-blue)]/15 text-xs font-medium text-[var(--accent-blue)]">
                    {member.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.displayName}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-[10px] ${roleColors[member.role] ?? "badge-amber"}`}>
                    {member.role}
                  </span>
                  {member.isDev && (
                    <span className="badge text-[10px] badge-amber">dev</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── API Keys ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Key className="h-4 w-4 text-[var(--accent-blue)]" />
              API 密钥管理
              <span className="text-xs text-[var(--text-muted)]">
                API Keys ({apiKeys.length})
              </span>
            </div>
            <button
              onClick={() => setShowCreateKey(!showCreateKey)}
              className="flex items-center gap-1 rounded bg-[var(--accent-blue)]/15 px-2.5 py-1.5 text-[10px] text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)]/25"
            >
              <Plus className="h-3 w-3" />
              Create Key
            </button>
          </div>

          {/* Create key form */}
          <AnimatePresence>
            {showCreateKey && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] p-3">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateKey()}
                    placeholder="Key name (e.g. production, staging)"
                    className="flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none"
                  />
                  <button
                    onClick={handleCreateKey}
                    disabled={creatingKey || !newKeyName.trim()}
                    className="flex items-center gap-1 rounded bg-[var(--accent-blue)] px-3 py-1.5 text-xs text-white disabled:opacity-60"
                  >
                    <Plus className={`h-3 w-3 ${creatingKey ? "animate-spin" : ""}`} />
                    {creatingKey ? "Creating..." : "Create"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateKey(false);
                      setNewKeyName("");
                    }}
                    className="rounded px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Newly created key display */}
          <AnimatePresence>
            {newKeyRaw && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded border border-[var(--accent-green)] bg-emerald-500/10 p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[var(--accent-green)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    API Key Created - Copy it now, it won&apos;t be shown again
                  </div>
                  <div className="flex items-center gap-2 rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2">
                    <span className="flex-1 truncate font-mono text-xs text-[var(--text-secondary)]">
                      {newKeyRaw}
                    </span>
                    <button
                      onClick={() => copyToClipboard(newKeyRaw)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => setNewKeyRaw(null)}
                    className="mt-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Key list */}
          {apiKeys.length === 0 ? (
            <div className="rounded border border-dashed border-[var(--border-color)] p-6 text-center text-xs text-[var(--text-muted)]">
              No API keys yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.keyId}
                  className="flex items-center justify-between rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{apiKey.name}</span>
                      {!apiKey.isActive && (
                        <span className="badge text-[10px] badge-red">revoked</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        {apiKey.maskedKey}
                      </span>
                      <button
                        onClick={() => copyToClipboard(apiKey.maskedKey)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        title="Copy masked key"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="mt-1 flex gap-3 text-[10px] text-[var(--text-muted)]">
                      <span>
                        Created{" "}
                        {new Date(apiKey.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                      {apiKey.lastUsedAt && (
                        <span>
                          Last used{" "}
                          {new Date(apiKey.lastUsedAt).toLocaleDateString("zh-CN")}
                        </span>
                      )}
                      {apiKey.scopes.length > 0 && (
                        <span>Scopes: {apiKey.scopes.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(apiKey.keyId)}
                    disabled={deletingKey === apiKey.keyId || !apiKey.isActive}
                    className="ml-3 flex items-center gap-1 rounded px-2 py-1.5 text-[10px] text-[var(--accent-red)] transition-colors hover:bg-red-500/10 disabled:opacity-40"
                  >
                    <Trash2 className={`h-3 w-3 ${deletingKey === apiKey.keyId ? "animate-spin" : ""}`} />
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* ── Usage Statistics ──────────────────────────────────────── */}
        {usage && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="card space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4 text-[var(--accent-blue)]" />
              使用统计
              <span className="text-xs text-[var(--text-muted)]">Usage Statistics</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <UsageStat
                label="Members"
                value={usage.members}
                icon={<Users className="h-4 w-4" />}
              />
              <UsageStat
                label="Active API Keys"
                value={usage.activeApiKeys}
                icon={<Key className="h-4 w-4" />}
              />
              <UsageStat
                label="Total Matches"
                value={usage.totalMatches}
                icon={<BarChart3 className="h-4 w-4" />}
              />
              <UsageStat
                label="Total Predictions"
                value={usage.totalPredictions}
                icon={<Shield className="h-4 w-4" />}
              />
            </div>
          </motion.div>
        )}

        {/* ── Billing Placeholder ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <CreditCard className="h-4 w-4 text-[var(--accent-blue)]" />
            计费信息
            <span className="text-xs text-[var(--text-muted)]">Billing</span>
          </div>

          <div className="rounded border border-dashed border-[var(--border-color)] p-6 text-center">
            <CreditCard className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              Billing is not yet configured
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              This workspace is on the <span className="font-medium text-[var(--accent-green)]">Free</span> plan.
              Billing features will be available in a future release.
            </p>
          </div>
        </motion.div>

        {/* ── Disclaimer ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="card border-[var(--accent-amber)] text-xs text-[var(--accent-amber)]"
        >
          <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
          本系统仅用于解说辅助，不提供任何投注建议。
          <span className="ml-1 text-[var(--text-muted)]">
            For commentary assistance, not betting advice.
          </span>
        </motion.div>
      </div>
    </div>
  );
}

// ── Usage Stat Card ──────────────────────────────────────────────────

function UsageStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 text-center">
      <div className="mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]">
        {icon}
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
