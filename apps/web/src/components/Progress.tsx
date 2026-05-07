"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

type ProgressColor = "blue" | "green" | "purple" | "amber" | "red";

interface BaseProgressProps {
  /** Current value between 0 and `max` */
  value: number;
  /** Maximum value (default 100) */
  max?: number;
  /** Accent color */
  color?: ProgressColor;
  /** Show a numeric label */
  showLabel?: boolean;
  /** Optional custom label suffix (e.g. "%" or "/100") */
  labelSuffix?: string;
  /** Additional class names */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Color maps                                                         */
/* ------------------------------------------------------------------ */

const trackBg = "bg-[var(--bg-primary)]";

const fillMap: Record<ProgressColor, string> = {
  blue: "bg-[var(--accent-blue)]",
  green: "bg-[var(--accent-green)]",
  purple: "bg-[var(--accent-purple)]",
  amber: "bg-[var(--accent-amber)]",
  red: "bg-[var(--accent-red)]",
};

const textMap: Record<ProgressColor, string> = {
  blue: "text-[var(--accent-blue)]",
  green: "text-[var(--accent-green)]",
  purple: "text-[var(--accent-purple)]",
  amber: "text-[var(--accent-amber)]",
  red: "text-[var(--accent-red)]",
};

const svgStrokeMap: Record<ProgressColor, string> = {
  blue: "var(--accent-blue)",
  green: "var(--accent-green)",
  purple: "var(--accent-purple)",
  amber: "var(--accent-amber)",
  red: "var(--accent-red)",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function clampPct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Pick color automatically based on percentage thresholds. */
function autoColor(pct: number): ProgressColor {
  if (pct >= 80) return "green";
  if (pct >= 50) return "blue";
  if (pct >= 25) return "amber";
  return "red";
}

/* ================================================================== */
/*  1. Linear Progress Bar                                             */
/* ================================================================== */

interface LinearProgressProps extends BaseProgressProps {
  /** Bar height in pixels (default 8) */
  height?: number;
  /** Animate the fill on mount / value change */
  animate?: boolean;
  /** Show indeterminate (skeleton) state */
  indeterminate?: boolean;
}

export function LinearProgress({
  value,
  max = 100,
  color,
  showLabel = false,
  labelSuffix = "%",
  height = 8,
  animate = true,
  indeterminate = false,
  className = "",
}: LinearProgressProps) {
  const pct = clampPct(value, max);
  const resolvedColor = color ?? autoColor(pct);

  return (
    <div className={`w-full ${className}`}>
      {/* Optional label row */}
      {showLabel && !indeterminate && (
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[var(--text-muted)]">进度</span>
          <span className={`font-medium tabular-nums ${textMap[resolvedColor]}`}>
            {Math.round(pct)}
            {labelSuffix}
          </span>
        </div>
      )}

      {/* Track */}
      <div
        className={`relative w-full overflow-hidden rounded-full ${trackBg}`}
        style={{ height }}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {indeterminate ? (
          /* Indeterminate shimmer */
          <motion.div
            className={`absolute inset-y-0 left-0 w-1/3 rounded-full ${fillMap[resolvedColor]}`}
            animate={{ x: ["-100%", "400%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ opacity: 0.7 }}
          />
        ) : (
          /* Determinate fill */
          <motion.div
            className={`h-full rounded-full ${fillMap[resolvedColor]}`}
            initial={animate ? { width: 0 } : false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  2. Circular Progress                                               */
/* ================================================================== */

interface CircularProgressProps extends BaseProgressProps {
  /** Diameter in pixels (default 64) */
  size?: number;
  /** Stroke width in pixels (default 5) */
  strokeWidth?: number;
  /** Show the numeric value inside the circle */
  showValue?: boolean;
  /** Animate on mount */
  animate?: boolean;
}

export function CircularProgress({
  value,
  max = 100,
  color,
  showLabel = false,
  labelSuffix = "%",
  size = 64,
  strokeWidth = 5,
  showValue = true,
  animate = true,
  className = "",
}: CircularProgressProps) {
  const pct = clampPct(value, max);
  const resolvedColor = color ?? autoColor(pct);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className={`relative inline-flex flex-col items-center gap-1 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-primary)"
          strokeWidth={strokeWidth}
        />
        {/* Fill arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={svgStrokeMap[resolvedColor]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={animate ? { strokeDashoffset: circumference } : { strokeDashoffset: offset }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>

      {/* Centered value */}
      {showValue && (
        <div
          className="absolute flex items-center justify-center"
          style={{ width: size, height: size }}
        >
          <span
            className={`text-sm font-bold tabular-nums ${textMap[resolvedColor]}`}
            style={{ fontSize: size > 80 ? 16 : 12 }}
          >
            {Math.round(pct)}
            {labelSuffix}
          </span>
        </div>
      )}

      {/* Optional label */}
      {showLabel && (
        <span className="text-[10px] text-[var(--text-muted)]">
          {Math.round(pct)}
          {labelSuffix}
        </span>
      )}
    </div>
  );
}

/* ================================================================== */
/*  3. Step Progress                                                   */
/* ================================================================== */

export type StepStatus = "complete" | "active" | "pending" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

interface StepProgressProps {
  steps: Step[];
  /** Orientation (default "horizontal") */
  orientation?: "horizontal" | "vertical";
  /** Accent color for active/complete steps */
  color?: ProgressColor;
  /** Additional class names */
  className?: string;
}

const stepStatusConfig: Record<
  StepStatus,
  { icon: typeof CheckCircle2; color: string; ring: string; connector: string }
> = {
  complete: {
    icon: CheckCircle2,
    color: "text-[var(--accent-green)]",
    ring: "border-[var(--accent-green)]",
    connector: "bg-[var(--accent-green)]",
  },
  active: {
    icon: Loader2,
    color: "text-[var(--accent-blue)]",
    ring: "border-[var(--accent-blue)]",
    connector: "bg-[var(--border-color)]",
  },
  pending: {
    icon: Circle,
    color: "text-[var(--text-muted)]",
    ring: "border-[var(--border-color)]",
    connector: "bg-[var(--border-color)]",
  },
  error: {
    icon: Circle,
    color: "text-[var(--accent-red)]",
    ring: "border-[var(--accent-red)]",
    connector: "bg-[var(--accent-red)]/30",
  },
};

export function StepProgress({
  steps,
  orientation = "horizontal",
  className = "",
}: StepProgressProps) {
  const isHorizontal = orientation === "horizontal";

  return (
    <div
      className={`flex ${isHorizontal ? "flex-row items-start" : "flex-col"} ${className}`}
      role="list"
    >
      {steps.map((step, index) => {
        const cfg = stepStatusConfig[step.status] ?? stepStatusConfig.pending;
        const Icon = cfg.icon;
        const isLast = index === steps.length - 1;

        return (
          <div
            key={step.id}
            className={`flex ${
              isHorizontal
                ? "flex-1 flex-col items-center"
                : "flex-row items-start gap-3"
            }`}
            role="listitem"
          >
            {/* Node + connector wrapper */}
            <div
              className={`flex ${
                isHorizontal
                  ? "flex-col items-center"
                  : "flex-col items-center"
              }`}
            >
              {/* Node circle */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.08, duration: 0.3 }}
                className={`
                  relative z-10 flex h-8 w-8 items-center justify-center
                  rounded-full border-2 ${cfg.ring}
                  ${step.status === "complete" ? "bg-[var(--accent-green)]/10" : "bg-[var(--bg-card)]"}
                `}
              >
                <Icon
                  className={`h-4 w-4 ${cfg.color} ${
                    step.status === "active" ? "animate-spin" : ""
                  }`}
                />
              </motion.div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`
                    ${isHorizontal ? "hidden" : "h-6 w-0.5"}
                    ${cfg.connector}
                  `}
                />
              )}
            </div>

            {/* Label + detail */}
            <div
              className={`${
                isHorizontal
                  ? "mt-2 flex flex-col items-center text-center"
                  : "mt-0 flex-1"
              }`}
            >
              <span
                className={`text-xs font-medium ${
                  step.status === "active"
                    ? "text-[var(--text-primary)]"
                    : step.status === "complete"
                      ? "text-[var(--text-secondary)]"
                      : step.status === "error"
                        ? "text-[var(--accent-red)]"
                        : "text-[var(--text-muted)]"
                }`}
              >
                {step.label}
              </span>
              {step.detail && (
                <span className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                  {step.detail}
                </span>
              )}
            </div>

            {/* Horizontal connector between nodes */}
            {isHorizontal && !isLast && (
              <div className="relative mx-1 mt-4 h-0.5 flex-1 self-start">
                <div className={`h-full ${step.status === "complete" ? cfg.connector : "bg-[var(--border-color)]"}`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  4. Data Completeness Composite                                     */
/* ================================================================== */

export interface DataCompletenessBarProps {
  /** Completeness score 0-100 */
  score: number;
  /** List of missing data fields */
  missingFields?: string[];
  /** Reasons the data is degraded */
  degradedReasons?: string[];
  /** Confidence cap applied to predictions */
  confidenceCap?: number;
  /** Data source label */
  dataSource?: "live" | "demo";
  /** Show detailed breakdown */
  showDetails?: boolean;
  /** Additional class names */
  className?: string;
}

export function DataCompletenessBar({
  score,
  missingFields = [],
  degradedReasons = [],
  confidenceCap,
  dataSource,
  showDetails = false,
  className = "",
}: DataCompletenessBarProps) {
  const color = autoColor(score);
  const hasIssues = missingFields.length > 0 || degradedReasons.length > 0;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--text-primary)]">
            数据完整度
          </span>
          {dataSource && (
            <span
              className={`badge text-[10px] ${
                dataSource === "live" ? "badge-green" : "badge-amber"
              }`}
            >
              {dataSource === "live" ? "实时" : "演示"}
            </span>
          )}
        </div>
        <span className={`text-sm font-bold tabular-nums ${textMap[color]}`}>
          {score}%
        </span>
      </div>

      {/* Progress bar */}
      <LinearProgress
        value={score}
        color={color}
        height={6}
        animate
      />

      {/* Confidence cap indicator */}
      {confidenceCap !== undefined && confidenceCap < 1 && (
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span>置信度上限:</span>
          <span className={`font-medium ${textMap[color]}`}>
            {Math.round(confidenceCap * 100)}%
          </span>
        </div>
      )}

      {/* Details (expandable section) */}
      {showDetails && hasIssues && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2 overflow-hidden"
        >
          {/* Missing fields */}
          {missingFields.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-[var(--text-muted)]">
                缺失字段
              </span>
              <div className="flex flex-wrap gap-1">
                {missingFields.map((field) => (
                  <span
                    key={field}
                    className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] text-[var(--accent-red)]"
                  >
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Degraded reasons */}
          {degradedReasons.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-[var(--text-muted)]">
                降级原因
              </span>
              <ul className="space-y-0.5">
                {degradedReasons.map((reason, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1 text-[10px] text-[var(--accent-amber)]"
                  >
                    <span className="mt-0.5">-</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  5. Loading Skeleton / Spinner                                      */
/* ================================================================== */

interface LoadingOverlayProps {
  /** Loading message */
  message?: string;
  /** Use a progress bar instead of spinner */
  progress?: number;
  /** Additional class names */
  className?: string;
}

export function LoadingOverlay({
  message = "加载中...",
  progress,
  className = "",
}: LoadingOverlayProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}
    >
      {progress !== undefined ? (
        <div className="w-48">
          <LinearProgress value={progress} color="blue" height={4} animate />
          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
            {message} ({Math.round(progress)}%)
          </p>
        </div>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-blue)]" />
          <span className="text-sm text-[var(--text-muted)]">{message}</span>
        </>
      )}
    </div>
  );
}

/* ================================================================== */
/*  6. Inline Data Sync Steps                                          */
/* ================================================================== */

interface DataSyncStepsProps {
  /** Current sync progress step index (0-based) */
  currentStep: number;
  /** Additional class names */
  className?: string;
}

/** Predefined steps for a data sync pipeline. */
const SYNC_STEPS: Array<{ id: string; label: string }> = [
  { id: "connect", label: "连接数据源" },
  { id: "fetch", label: "拉取数据" },
  { id: "validate", label: "校验字段" },
  { id: "transform", label: "转换格式" },
  { id: "complete", label: "同步完成" },
];

export function DataSyncSteps({
  currentStep,
  className = "",
}: DataSyncStepsProps) {
  const steps: Step[] = SYNC_STEPS.map((s, i) => ({
    id: s.id,
    label: s.label,
    status:
      i < currentStep
        ? "complete"
        : i === currentStep
          ? "active"
          : "pending",
  }));

  return <StepProgress steps={steps} orientation="vertical" className={className} />;
}
