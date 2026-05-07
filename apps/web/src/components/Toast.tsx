"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ToastContext,
  type Toast,
  type ToastVariant,
} from "@/lib/toast";

/* ------------------------------------------------------------------ */
/*  Variant styles                                                     */
/* ------------------------------------------------------------------ */

const variantConfig: Record<
  ToastVariant,
  { icon: string; border: string; bg: string; text: string }
> = {
  success: {
    icon: "✓",
    border: "border-emerald-500/50",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  error: {
    icon: "✕",
    border: "border-red-500/50",
    bg: "bg-red-500/10",
    text: "text-red-400",
  },
  warning: {
    icon: "⚠",
    border: "border-amber-500/50",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  info: {
    icon: "ℹ",
    border: "border-blue-500/50",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
};

/* ------------------------------------------------------------------ */
/*  Single toast item                                                  */
/* ------------------------------------------------------------------ */

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const cfg = variantConfig[toast.variant];

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm ${cfg.border} ${cfg.bg}`}
    >
      <span className={`mt-0.5 text-sm font-bold ${cfg.text}`}>
        {cfg.icon}
      </span>

      <p className="flex-1 text-sm text-[var(--text-primary)]">
        {toast.message}
      </p>

      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-2 shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
        aria-label="Dismiss notification"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M1 1l12 12M13 1L1 13" />
        </svg>
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

let _nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = `toast-${++_nextId}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
    },
    [],
  );

  const ctx = useMemo(
    () => ({ toasts, addToast, removeToast }),
    [toasts, addToast, removeToast],
  );

  return (
    <ToastContext.Provider value={ctx}>
      {children}

      {/* Toast container — fixed top-right */}
      <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-col items-end gap-2">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
