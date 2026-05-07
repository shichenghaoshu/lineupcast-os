"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60"
            onClick={onCancel}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-sm rounded-lg border bg-[var(--bg-secondary)] p-5 shadow-xl"
              style={{
                borderColor: destructive
                  ? "var(--accent-red)"
                  : "var(--border-color)",
              }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby="confirm-dialog-message"
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                {destructive && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15">
                    <AlertTriangle className="h-4 w-4 text-[var(--accent-red)]" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h2
                    id="confirm-dialog-title"
                    className={`text-sm font-semibold ${
                      destructive
                        ? "text-[var(--accent-red)]"
                        : "text-[var(--text-primary)]"
                    }`}
                  >
                    {title}
                  </h2>
                  <p
                    id="confirm-dialog-message"
                    className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]"
                  >
                    {message}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  onClick={onCancel}
                  className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    destructive
                      ? "bg-[var(--accent-red)] text-white hover:bg-red-600"
                      : "bg-[var(--accent-blue)] text-white hover:bg-blue-600"
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
