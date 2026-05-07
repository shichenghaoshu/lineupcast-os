"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  Download,
  FileUp,
  Info,
  Loader2,
  Play,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/Button";
import { PredictionChart } from "@/components/PredictionChart";
import { TopBar } from "@/components/TopBar";
import { MatchTimeline } from "@/components/MatchTimeline";
import { MatchCard } from "@/components/MatchCard";
import {
  createMatchBrief,
  getDataCompleteness,
  generateAll,
  listAvailableMatches,
  type ApiMatch,
  type ApiPrediction,
  type DataCompletenessInfo,
  type MatchBrief,
  type ScriptResult,
} from "@/lib/api-client";

// ── Workflow steps ──────────────────────────────────────────────────

type WorkflowStep =
  | "select"
  | "brief"
  | "upload"
  | "check"
  | "predict"
  | "script"
  | "overlay"
  | "done";

const STEP_ORDER: WorkflowStep[] = [
  "select",
  "brief",
  "upload",
  "check",
  "predict",
  "script",
  "overlay",
  "done",
];

const STEP_LABELS: Record<WorkflowStep, { zh: string; en: string }> = {
  select: { zh: "选择比赛", en: "Select Match" },
  brief: { zh: "创建简报", en: "Create Brief" },
  upload: { zh: "上传数据", en: "Upload Data" },
  check: { zh: "检查完整性", en: "Check Data" },
  predict: { zh: "生成预测", en: "Generate Prediction" },
  script: { zh: "生成稿件", en: "Generate Script" },
  overlay: { zh: "生成覆盖层", en: "Generate Overlay" },
  done: { zh: "完成", en: "Complete" },
};

// ── Component ───────────────────────────────────────────────────────

export default function MatchCenterPage() {
  // Language
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const t = useCallback(
    (zh: string, en: string) => (lang === "zh" ? zh : en),
    [lang],
  );

  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("select");
  const [stepStatus, setStepStatus] = useState<
    Record<WorkflowStep, "pending" | "active" | "done" | "error">
  >({
    select: "active",
    brief: "pending",
    upload: "pending",
    check: "pending",
    predict: "pending",
    script: "pending",
    overlay: "pending",
    done: "pending",
  });

  // Data state
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<ApiMatch | null>(null);
  const [brief, setBrief] = useState<MatchBrief | null>(null);
  const [completeness, setCompleteness] = useState<DataCompletenessInfo | null>(null);
  const [prediction, setPrediction] = useState<ApiPrediction | null>(null);
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null);
  const [overlayStatus, setOverlayStatus] = useState<string | null>(null);

  // Loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  // Manual form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualHome, setManualHome] = useState("");
  const [manualAway, setManualAway] = useState("");
  const [manualCompetition, setManualCompetition] = useState("");
  const [manualKickoff, setManualKickoff] = useState("");

  // CSV upload
  const lineupInputRef = useRef<HTMLInputElement>(null);
  const statsInputRef = useRef<HTMLInputElement>(null);
  const [lineupCsvName, setLineupCsvName] = useState<string | null>(null);
  const [statsCsvName, setStatsCsvName] = useState<string | null>(null);

  // ── Load available matches on mount ──────────────────────────────

  useEffect(() => {
    let active = true;
    listAvailableMatches()
      .then((data) => {
        if (!active) return;
        if (data.length > 0 && data[0].matchId.startsWith("demo")) {
          setIsDemo(true);
        }
        setMatches(data);
      })
      .catch(() => {
        if (active) setIsDemo(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // ── Step helpers ─────────────────────────────────────────────────

  const markStepDone = useCallback(
    (step: WorkflowStep, next: WorkflowStep) => {
      setStepStatus((prev) => ({ ...prev, [step]: "done", [next]: "active" }));
      setCurrentStep(next);
    },
    [],
  );

  const markStepError = useCallback((step: WorkflowStep, msg: string) => {
    setStepStatus((prev) => ({ ...prev, [step]: "error" }));
    setError(msg);
    setLoading(false);
  }, []);

  // ── Step 1: Select Match ────────────────────────────────────────

  const handleSelectMatch = useCallback(
    (match: ApiMatch) => {
      setSelectedMatch(match);
      setError(null);
      markStepDone("select", "brief");
    },
    [markStepDone],
  );

  const handleManualCreate = useCallback(() => {
    if (!manualHome.trim() || !manualAway.trim()) {
      setError(t("请输入主队和客队名称", "Please enter both home and away team names"));
      return;
    }
    const match: ApiMatch = {
      matchId: `manual-${Date.now()}`,
      homeTeam: { name: manualHome.trim() },
      awayTeam: { name: manualAway.trim() },
      competition: manualCompetition.trim() || undefined,
      kickoff: manualKickoff || new Date().toISOString(),
      status: "upcoming",
    };
    setSelectedMatch(match);
    setShowManualForm(false);
    setError(null);
    markStepDone("select", "brief");
  }, [manualHome, manualAway, manualCompetition, manualKickoff, t, markStepDone]);

  // ── Step 2: Create Brief ────────────────────────────────────────

  const handleCreateBrief = useCallback(async () => {
    if (!selectedMatch) return;
    setLoading(true);
    setError(null);
    try {
      const result = await createMatchBrief(selectedMatch.matchId);
      setBrief(result);
      markStepDone("brief", "upload");
    } catch (err: unknown) {
      markStepError("brief", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMatch, markStepDone, markStepError]);

  // ── Step 3: Upload CSV (optional) ──────────────────────────────

  const handleCsvUpload = useCallback(
    (type: "lineup" | "stats", file: File | null) => {
      if (!file) return;
      if (type === "lineup") {
        setLineupCsvName(file.name);
      } else {
        setStatsCsvName(file.name);
      }
    },
    [],
  );

  const handleSkipUpload = useCallback(() => {
    markStepDone("upload", "check");
  }, [markStepDone]);

  const handleConfirmUpload = useCallback(() => {
    markStepDone("upload", "check");
  }, [markStepDone]);

  // ── Step 4: Check Completeness ─────────────────────────────────

  const handleCheckCompleteness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const info = await getDataCompleteness();
      setCompleteness(info);
      if (info.dataSource === "demo") setIsDemo(true);
      markStepDone("check", "predict");
    } catch (err: unknown) {
      markStepError("check", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [markStepDone, markStepError]);

  // ── Step 5: Generate Prediction ────────────────────────────────

  const handleGeneratePrediction = useCallback(async () => {
    if (!selectedMatch) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateAll(selectedMatch.matchId);
      setPrediction(result.prediction);
      setScriptResult(result.script);
      if (result.overlay.status === "demo") setIsDemo(true);
      setOverlayStatus(result.overlay.status || "generated");
      // Skip ahead — prediction, script, and overlay all generated
      setStepStatus({
        select: "done",
        brief: "done",
        upload: "done",
        check: "done",
        predict: "done",
        script: "done",
        overlay: "done",
        done: "active",
      });
      setCurrentStep("done");
    } catch (err: unknown) {
      markStepError("predict", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMatch, markStepError]);

  // ── Sub-step: generate script only ─────────────────────────────

  const handleGenerateScript = useCallback(async () => {
    if (!selectedMatch) return;
    setLoading(true);
    setError(null);
    try {
      const { generateScript } = await import("@/lib/api-client");
      const result = await generateScript(selectedMatch.matchId, {
        language: "zh",
        style: "professional",
        duration: "30s",
      });
      setScriptResult(result);
      markStepDone("script", "overlay");
    } catch (err: unknown) {
      markStepError("script", err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedMatch, markStepDone, markStepError]);

  // ── Sub-step: generate overlay only ────────────────────────────

  const handleGenerateOverlay = useCallback(() => {
    setOverlayStatus("generated");
    markStepDone("overlay", "done");
  }, [markStepDone]);

  // ── Derived ─────────────────────────────────────────────────────

  const matchTitle = useMemo(() => {
    if (!selectedMatch) return t("赛事中心", "Match Center");
    return `${selectedMatch.homeTeam.name} vs ${selectedMatch.awayTeam.name}`;
  }, [selectedMatch, t]);

  const subtitle = useMemo(() => {
    if (!selectedMatch) return t("完整工作流：选择 -> 同步 -> 上传 -> 检查 -> 预测 -> 稿件 -> 覆盖层", "Full workflow: select -> sync -> upload -> check -> predict -> script -> overlay");
    return `${selectedMatch.competition ?? t("友谊赛", "Friendly")} · ${selectedMatch.status}`;
  }, [selectedMatch, t]);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <TopBar title={matchTitle} subtitle={subtitle} />

      <div className="space-y-4 p-4 sm:p-6">
        {/* Language toggle + demo badge */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Database className="h-3.5 w-3.5" />
            {t("工作流状态", "Workflow Status")}
          </div>
          <div className="flex items-center gap-2">
            {isDemo && (
              <span className="badge-amber text-[10px]">
                {t("演示模式", "Demo Mode")}
              </span>
            )}
            <div className="flex rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-1">
              {(["zh", "en"] as const).map((item) => (
                <button
                  key={item}
                  onClick={() => setLang(item)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    lang === item
                      ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item === "zh" ? "中文" : "EN"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Workflow stepper */}
        <WorkflowStepper
          steps={STEP_ORDER}
          labels={STEP_LABELS}
          status={stepStatus}
          current={currentStep}
          lang={lang}
        />

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="card border-[var(--accent-red)]/40 bg-[var(--accent-red)]/5 text-sm text-[var(--accent-red)]"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <div className="font-medium">{t("错误", "Error")}</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Step content ──────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {currentStep === "select" && (
            <StepSelect
              key="select"
              matches={matches}
              showManualForm={showManualForm}
              setShowManualForm={setShowManualForm}
              manualHome={manualHome}
              setManualHome={setManualHome}
              manualAway={manualAway}
              setManualAway={setManualAway}
              manualCompetition={manualCompetition}
              setManualCompetition={setManualCompetition}
              manualKickoff={manualKickoff}
              setManualKickoff={setManualKickoff}
              onSelect={handleSelectMatch}
              onManualCreate={handleManualCreate}
              t={t}
            />
          )}

          {currentStep === "brief" && selectedMatch && (
            <StepBrief
              key="brief"
              match={selectedMatch}
              loading={loading}
              onCreateBrief={handleCreateBrief}
              t={t}
            />
          )}

          {currentStep === "upload" && (
            <StepUpload
              key="upload"
              lineupCsvName={lineupCsvName}
              statsCsvName={statsCsvName}
              lineupInputRef={lineupInputRef}
              statsInputRef={statsInputRef}
              onUpload={handleCsvUpload}
              onSkip={handleSkipUpload}
              onConfirm={handleConfirmUpload}
              t={t}
            />
          )}

          {currentStep === "check" && (
            <StepCheck
              key="check"
              completeness={completeness}
              loading={loading}
              onCheck={handleCheckCompleteness}
              t={t}
              lang={lang}
            />
          )}

          {currentStep === "predict" && selectedMatch && (
            <StepPredict
              key="predict"
              match={selectedMatch}
              completeness={completeness}
              loading={loading}
              onGenerate={handleGeneratePrediction}
              t={t}
            />
          )}

          {currentStep === "script" && (
            <StepScript
              key="script"
              scriptResult={scriptResult}
              loading={loading}
              onGenerate={handleGenerateScript}
              t={t}
            />
          )}

          {currentStep === "overlay" && (
            <StepOverlay
              key="overlay"
              overlayStatus={overlayStatus}
              onGenerate={handleGenerateOverlay}
              t={t}
            />
          )}

          {currentStep === "done" && selectedMatch && (
            <StepDone
              key="done"
              match={selectedMatch}
              prediction={prediction}
              scriptResult={scriptResult}
              overlayStatus={overlayStatus}
              completeness={completeness}
              t={t}
              lang={lang}
            />
          )}
        </AnimatePresence>

        {/* Disclaimer */}
        <div className="card space-y-2 border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/5">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-amber)]">
            <Info className="h-3.5 w-3.5" />
            {t("重要声明", "Important")}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {t(
              "本工具仅用于解说辅助，不构成任何投注建议。AI改写模型输出，不创造概率。",
              "For commentary assistance only, not betting advice. AI rewrites model outputs; it does not invent probabilities.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Workflow Stepper ────────────────────────────────────────────────

function WorkflowStepper({
  steps,
  labels,
  status,
  current,
  lang,
}: {
  steps: WorkflowStep[];
  labels: Record<WorkflowStep, { zh: string; en: string }>;
  status: Record<WorkflowStep, "pending" | "active" | "done" | "error">;
  current: WorkflowStep;
  lang: "zh" | "en";
}) {
  return (
    <div className="card overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max px-2 py-1">
        {steps.map((step, i) => {
          const s = status[step];
          const isActive = step === current;
          return (
            <div key={step} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  s === "done"
                    ? "bg-[var(--accent-green)]/15 text-[var(--accent-green)]"
                    : s === "error"
                      ? "bg-[var(--accent-red)]/15 text-[var(--accent-red)]"
                      : isActive
                        ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                        : "bg-[var(--bg-primary)] text-[var(--text-muted)]"
                }`}
              >
                {s === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : s === "error" ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : isActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span className="h-3.5 w-3.5 rounded-full border border-current" />
                )}
                <span className="hidden sm:inline">{labels[step][lang]}</span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="mx-1 h-3.5 w-3.5 text-[var(--text-muted)]/50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 1: Select Match ───────────────────────────────────────────

function StepSelect({
  matches,
  showManualForm,
  setShowManualForm,
  manualHome,
  setManualHome,
  manualAway,
  setManualAway,
  manualCompetition,
  setManualCompetition,
  manualKickoff,
  setManualKickoff,
  onSelect,
  onManualCreate,
  t,
}: {
  matches: ApiMatch[];
  showManualForm: boolean;
  setShowManualForm: (v: boolean) => void;
  manualHome: string;
  setManualHome: (v: string) => void;
  manualAway: string;
  setManualAway: (v: string) => void;
  manualCompetition: string;
  setManualCompetition: (v: string) => void;
  manualKickoff: string;
  setManualKickoff: (v: string) => void;
  onSelect: (m: ApiMatch) => void;
  onManualCreate: () => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-4"
    >
      {/* Available matches */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ClipboardList className="h-4 w-4 text-[var(--accent-blue)]" />
            {t("选择比赛", "Select Match")}
          </div>
          <Button
            onClick={() => setShowManualForm(!showManualForm)}
            variant="ghost"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            className="bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/20"
          >
            {t("手动创建", "Create Manually")}
          </Button>
        </div>

        {matches.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match) => (
              <MatchCard
                key={match.matchId}
                match={match}
                variant="selectable"
                onClick={() => onSelect(match)}
                showVenue={false}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)] p-6 text-center text-sm text-[var(--text-muted)]">
            {t("暂无可用比赛，请手动创建", "No matches available. Create one manually.")}
          </div>
        )}
      </div>

      {/* Manual creation form */}
      <AnimatePresence>
        {showManualForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="card space-y-3 overflow-hidden"
          >
            <div className="text-sm font-medium">
              {t("手动创建比赛", "Create Match Manually")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InputField
                label={t("主队", "Home Team")}
                value={manualHome}
                onChange={setManualHome}
                placeholder={t("例如：曼联", "e.g. Manchester United")}
              />
              <InputField
                label={t("客队", "Away Team")}
                value={manualAway}
                onChange={setManualAway}
                placeholder={t("例如：利物浦", "e.g. Liverpool")}
              />
              <InputField
                label={t("赛事", "Competition")}
                value={manualCompetition}
                onChange={setManualCompetition}
                placeholder={t("例如：英超", "e.g. Premier League")}
              />
              <InputField
                label={t("开球时间", "Kickoff")}
                value={manualKickoff}
                onChange={setManualKickoff}
                type="datetime-local"
              />
            </div>
            <Button
              onClick={onManualCreate}
            >
              {t("创建比赛", "Create Match")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Step 2: Create Brief ───────────────────────────────────────────

function StepBrief({
  match,
  loading,
  onCreateBrief,
  t,
}: {
  match: ApiMatch;
  loading: boolean;
  onCreateBrief: () => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Zap className="h-4 w-4 text-[var(--accent-amber)]" />
        {t("创建比赛简报", "Create Match Brief")}
      </div>

      <MatchCard match={match} variant="compact" showVenue={false} />

      <p className="text-xs text-[var(--text-secondary)]">
        {t(
          "比赛简报将整合阵容、统计数据和赛事信息，用于后续的预测和稿件生成。",
          "The match brief consolidates lineup, stats, and fixture data for downstream prediction and script generation.",
        )}
      </p>

      <Button
        onClick={onCreateBrief}
        loading={loading}
        icon={<Zap className="h-4 w-4" />}
      >
        {loading ? t("创建中...", "Creating...") : t("创建简报", "Create Brief")}
      </Button>
    </motion.div>
  );
}

// ── Step 3: Upload CSV ─────────────────────────────────────────────

function StepUpload({
  lineupCsvName,
  statsCsvName,
  lineupInputRef,
  statsInputRef,
  onUpload,
  onSkip,
  onConfirm,
  t,
}: {
  lineupCsvName: string | null;
  statsCsvName: string | null;
  lineupInputRef: React.RefObject<HTMLInputElement | null>;
  statsInputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (type: "lineup" | "stats", file: File | null) => void;
  onSkip: () => void;
  onConfirm: () => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileUp className="h-4 w-4 text-[var(--accent-green)]" />
        {t("上传数据 (可选)", "Upload Data (Optional)")}
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        {t(
          "上传 lineup.csv 和 player_stats.csv 可以提高数据完整性评分。如果跳过，系统将使用API数据或演示数据。",
          "Upload lineup.csv and player_stats.csv to improve data completeness. If skipped, the system will use API or demo data.",
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <UploadCard
          label="lineup.csv"
          description={t("阵容数据", "Lineup data")}
          fileName={lineupCsvName}
          inputRef={lineupInputRef}
          onFile={(f) => onUpload("lineup", f)}
          t={t}
        />
        <UploadCard
          label="player_stats.csv"
          description={t("球员统计数据", "Player stats")}
          fileName={statsCsvName}
          inputRef={statsInputRef}
          onFile={(f) => onUpload("stats", f)}
          t={t}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={onConfirm}
          icon={<CheckCircle2 className="h-4 w-4" />}
        >
          {t("确认上传", "Confirm Upload")}
        </Button>
        <Button
          onClick={onSkip}
          variant="secondary"
        >
          {t("跳过，使用API数据", "Skip, Use API Data")}
        </Button>
      </div>
    </motion.div>
  );
}

// ── Step 4: Check Completeness ─────────────────────────────────────

function StepCheck({
  completeness,
  loading,
  onCheck,
  t,
  lang,
}: {
  completeness: DataCompletenessInfo | null;
  loading: boolean;
  onCheck: () => void;
  t: (zh: string, en: string) => string;
  lang: "zh" | "en";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-4"
    >
      <div className="card space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Database className="h-4 w-4 text-[var(--accent-blue)]" />
          {t("数据完整性检查", "Data Completeness Check")}
        </div>

        {!completeness && (
          <Button
            onClick={onCheck}
            loading={loading}
            icon={<RefreshCcw className="h-4 w-4" />}
          >
            {loading ? t("检查中...", "Checking...") : t("检查数据完整性", "Check Data Completeness")}
          </Button>
        )}

        {completeness && (
          <>
            {/* Score bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">
                  {t("数据评分", "Data Score")}
                </span>
                <span
                  className={`font-medium tabular-nums ${
                    completeness.score >= 80
                      ? "text-[var(--accent-green)]"
                      : completeness.score >= 60
                        ? "text-[var(--accent-amber)]"
                        : "text-[var(--accent-red)]"
                  }`}
                >
                  {completeness.score}/100
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-primary)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completeness.score}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`h-full rounded-full ${
                    completeness.score >= 80
                      ? "bg-[var(--accent-green)]"
                      : completeness.score >= 60
                        ? "bg-[var(--accent-amber)]"
                        : "bg-[var(--accent-red)]"
                  }`}
                />
              </div>
            </div>

            {/* Missing fields */}
            {completeness.missingFields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <ShieldAlert className="h-3.5 w-3.5 text-[var(--accent-red)]" />
                  {t("缺失字段", "Missing Fields")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {completeness.missingFields.map((field) => (
                    <span key={field} className="badge-red text-[10px]">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Degraded reasons */}
            {completeness.degradedReasons.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-[var(--text-muted)]">
                  {t("降级原因", "Degraded Reasons")}
                </div>
                <div className="space-y-1">
                  {completeness.degradedReasons.map((reason) => (
                    <div
                      key={reason}
                      className="flex items-start gap-2 rounded bg-[var(--bg-primary)] px-2 py-1.5 text-xs text-[var(--text-secondary)]"
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-[var(--accent-amber)]" />
                      {reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confidence cap warning */}
            {completeness.confidenceCap < 1 && (
              <div className="flex items-start gap-2 rounded border border-[var(--accent-amber)]/30 bg-[var(--accent-amber)]/5 px-3 py-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--accent-amber)]" />
                <div className="text-xs text-[var(--text-secondary)]">
                  {t(
                    `由于数据不完整，置信度上限已设为 ${Math.round(completeness.confidenceCap * 100)}%。`,
                    `Confidence capped at ${Math.round(completeness.confidenceCap * 100)}% due to incomplete data.`,
                  )}
                </div>
              </div>
            )}

            {/* Data source */}
            <div className="flex items-center gap-2 rounded bg-[var(--bg-primary)] px-3 py-2 text-xs">
              <span className="text-[var(--text-muted)]">
                {t("数据来源", "Data Source")}
              </span>
              <span
                className={`badge text-[10px] ${
                  completeness.dataSource === "live"
                    ? "badge-green"
                    : "badge-amber"
                }`}
              >
                {completeness.dataSource === "live"
                  ? t("实时 API", "Live API")
                  : t("演示 / 降级", "Demo / Fallback")}
              </span>
            </div>

            {/* Continue button */}
            <Button
              onClick={onCheck}
              icon={<CheckCircle2 className="h-4 w-4" />}
            >
              {t("继续到预测", "Continue to Prediction")}
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Step 5: Generate Prediction ────────────────────────────────────

function StepPredict({
  match,
  completeness,
  loading,
  onGenerate,
  t,
}: {
  match: ApiMatch;
  completeness: DataCompletenessInfo | null;
  loading: boolean;
  onGenerate: () => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Target className="h-4 w-4 text-[var(--accent-green)]" />
        {t("生成预测", "Generate Prediction")}
      </div>

      <MatchCard match={match} variant="compact" showVenue={false} />
      {completeness && (
        <div className="card">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--text-muted)]">
              {t("数据评分", "Data Score")}:
            </span>
            <span
              className={`font-medium ${
                completeness.score >= 80
                  ? "text-[var(--accent-green)]"
                  : completeness.score >= 60
                    ? "text-[var(--accent-amber)]"
                    : "text-[var(--accent-red)]"
              }`}
            >
              {completeness.score}/100
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-secondary)]">
        {t(
          "将一次性生成预测、稿件和覆盖层数据。也可以在后续步骤中分别生成。",
          "This will generate prediction, script, and overlay data all at once. You can also generate them individually in subsequent steps.",
        )}
      </p>

      <div className="flex items-center gap-3">
        <Button
          onClick={onGenerate}
          loading={loading}
          icon={<Play className="h-4 w-4" />}
          className="bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green)]/80"
        >
          {loading ? t("生成中...", "Generating...") : t("一键生成全部", "Generate All")}
        </Button>
      </div>
    </motion.div>
  );
}

// ── Step 6: Generate Script ────────────────────────────────────────

function StepScript({
  scriptResult,
  loading,
  onGenerate,
  t,
}: {
  scriptResult: ScriptResult | null;
  loading: boolean;
  onGenerate: () => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileUp className="h-4 w-4 text-[var(--accent-purple)]" />
        {t("生成AI稿件", "Generate AI Script")}
      </div>

      {scriptResult ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/5 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-green)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t("稿件已生成", "Script Generated")}
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-4">
              {scriptResult.script}
            </p>
          </div>
          <Button
            onClick={onGenerate}
            variant="secondary"
            icon={<RefreshCcw className="h-4 w-4" />}
          >
            {t("重新生成", "Regenerate")}
          </Button>
        </div>
      ) : (
        <Button
          onClick={onGenerate}
          loading={loading}
          icon={<Play className="h-4 w-4" />}
          className="bg-[var(--accent-purple)] text-white hover:bg-[var(--accent-purple)]/80"
        >
          {loading ? t("生成中...", "Generating...") : t("生成稿件", "Generate Script")}
        </Button>
      )}
    </motion.div>
  );
}

// ── Step 7: Generate Overlay ───────────────────────────────────────

function StepOverlay({
  overlayStatus,
  onGenerate,
  t,
}: {
  overlayStatus: string | null;
  onGenerate: () => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="card space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Download className="h-4 w-4 text-[var(--accent-blue)]" />
        {t("生成OBS覆盖层", "Generate OBS Overlay")}
      </div>

      {overlayStatus ? (
        <div className="rounded-lg border border-[var(--accent-green)]/30 bg-[var(--accent-green)]/5 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-green)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("覆盖层已生成", "Overlay Generated")}
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("状态", "Status")}: {overlayStatus}
          </p>
        </div>
      ) : (
        <Button
          onClick={onGenerate}
          icon={<Play className="h-4 w-4" />}
        >
          {t("生成覆盖层", "Generate Overlay")}
        </Button>
      )}
    </motion.div>
  );
}

// ── Step Done: Summary ─────────────────────────────────────────────

function StepDone({
  match,
  prediction,
  scriptResult,
  overlayStatus,
  completeness,
  t,
  lang,
}: {
  match: ApiMatch;
  prediction: ApiPrediction | null;
  scriptResult: ScriptResult | null;
  overlayStatus: string | null;
  completeness: DataCompletenessInfo | null;
  t: (zh: string, en: string) => string;
  lang: "zh" | "en";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-4"
    >
      {/* Success banner */}
      <div className="card border-[var(--accent-green)]/30 bg-[var(--accent-green)]/5">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--accent-green)]">
          <CheckCircle2 className="h-4 w-4" />
          {t("工作流完成", "Workflow Complete")}
        </div>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          {t(
            "所有步骤已完成。以下是生成结果的摘要。",
            "All steps completed. Below is a summary of generated results.",
          )}
        </p>
      </div>

      {/* Prediction summary */}
      {prediction && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-[var(--accent-green)]" />
            {t("预测结果", "Prediction Results")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: t("主胜", "Home Win"), value: `${prediction.homeWin}%`, color: "var(--accent-green)" },
              { label: t("平局", "Draw"), value: `${prediction.draw}%`, color: "var(--accent-amber)" },
              { label: t("客胜", "Away Win"), value: `${prediction.awayWin}%`, color: "var(--accent-blue)" },
              { label: t("置信度", "Confidence"), value: `${prediction.confidence}%`, color: "var(--accent-purple)" },
            ].map((card) => (
              <div key={card.label} className="rounded-lg bg-[var(--bg-primary)] p-3 text-center">
                <div className="text-xs text-[var(--text-muted)]">{card.label}</div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: card.color }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-6 text-center">
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t("预期主队进球", "Expected Home Goals")}</div>
              <div className="text-2xl font-bold text-[var(--accent-green)]">{prediction.expectedHomeGoals.toFixed(1)}</div>
            </div>
            <div className="text-xl text-[var(--text-muted)]">-</div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t("预期客队进球", "Expected Away Goals")}</div>
              <div className="text-2xl font-bold text-[var(--accent-blue)]">{prediction.expectedAwayGoals.toFixed(1)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Prediction charts */}
      {prediction && (
        <PredictionChart
          prediction={prediction}
          homeTeamName={match.homeTeam.name}
          awayTeamName={match.awayTeam.name}
          language={lang}
        />
      )}

      {/* Script preview */}
      {scriptResult && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileUp className="h-4 w-4 text-[var(--accent-purple)]" />
            {t("AI稿件预览", "AI Script Preview")}
          </div>
          <div className="rounded-lg bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-secondary)]">
            <p className="line-clamp-6">{scriptResult.script}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <span>{t("模型", "Model")}: {scriptResult.model}</span>
            <span>{t("延迟", "Latency")}: {scriptResult.latencyMs}ms</span>
            {scriptResult.fallback && (
              <span className="badge-amber text-[10px]">{t("降级", "Fallback")}</span>
            )}
          </div>
        </div>
      )}

      {/* Overlay status */}
      {overlayStatus && (
        <div className="card space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Download className="h-4 w-4 text-[var(--accent-blue)]" />
            {t("OBS覆盖层", "OBS Overlay")}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-green)]" />
            <span className="text-[var(--text-secondary)]">
              {t("状态", "Status")}: {overlayStatus}
            </span>
          </div>
        </div>
      )}

      {/* Data completeness summary */}
      {completeness && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Database className="h-4 w-4 text-[var(--accent-blue)]" />
              {t("数据完整性", "Data Completeness")}
            </div>
            <span
              className={`badge text-[10px] ${
                completeness.dataSource === "live" ? "badge-green" : "badge-amber"
              }`}
            >
              {completeness.dataSource === "live"
                ? t("实时", "Live")
                : t("演示", "Demo")}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">{t("评分", "Score")}</span>
              <span
                className={`font-medium tabular-nums ${
                  completeness.score >= 80
                    ? "text-[var(--accent-green)]"
                    : completeness.score >= 60
                      ? "text-[var(--accent-amber)]"
                      : "text-[var(--accent-red)]"
                }`}
              >
                {completeness.score}/100
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--bg-primary)]">
              <div
                className={`h-full rounded-full ${
                  completeness.score >= 80
                    ? "bg-[var(--accent-green)]"
                    : completeness.score >= 60
                      ? "bg-[var(--accent-amber)]"
                      : "bg-[var(--accent-red)]"
                }`}
                style={{ width: `${completeness.score}%` }}
              />
            </div>
          </div>
          {completeness.missingFields.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <ShieldAlert className="h-3.5 w-3.5 text-[var(--accent-red)]" />
                {t("缺失字段", "Missing Fields")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {completeness.missingFields.map((field) => (
                  <span key={field} className="badge-red text-[10px]">{field}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Match Timeline */}
      <MatchTimeline
        homeTeam={match.homeTeam.name}
        awayTeam={match.awayTeam.name}
        homeScore={match.score?.home ?? 2}
        awayScore={match.score?.away ?? 2}
        lang={lang}
      />
    </motion.div>
  );
}

// ── Shared components ──────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--text-muted)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30"
      />
    </div>
  );
}

function UploadCard({
  label,
  description,
  fileName,
  inputRef,
  onFile,
  t,
}: {
  label: string;
  description: string;
  fileName: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File | null) => void;
  t: (zh: string, en: string) => string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
      <div className="text-sm font-medium">{label}</div>
      <div className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</div>
      {fileName ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-[var(--accent-green)]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {fileName}
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex items-center gap-1.5 rounded border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
        >
          <FileUp className="h-3.5 w-3.5" />
          {t("选择文件", "Choose File")}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
