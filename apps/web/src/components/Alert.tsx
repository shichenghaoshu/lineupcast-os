"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps {
  /** Visual variant determining color and icon */
  variant: AlertVariant;
  /** Bold title shown above the message */
  title?: string;
  /** Descriptive message body */
  message: string;
  /** Show a close button that hides the alert */
  dismissible?: boolean;
  /** Callback fired when the user closes the alert */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Variant configuration                                              */
/* ------------------------------------------------------------------ */

const variantConfig: Record<
  AlertVariant,
  {
    Icon: typeof Info;
    border: string;
    bg: string;
    text: string;
    iconColor: string;
  }
> = {
  info: {
    Icon: Info,
    border: "border-blue-500/40",
    bg: "bg-blue-500/5",
    text: "text-blue-400",
    iconColor: "text-blue-400",
  },
  success: {
    Icon: CheckCircle2,
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    text: "text-emerald-400",
    iconColor: "text-emerald-400",
  },
  warning: {
    Icon: AlertTriangle,
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    text: "text-amber-400",
    iconColor: "text-amber-400",
  },
  error: {
    Icon: XCircle,
    border: "border-red-500/40",
    bg: "bg-red-500/5",
    text: "text-red-400",
    iconColor: "text-red-400",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Alert({
  variant,
  title,
  message,
  dismissible = false,
  onDismiss,
  className = "",
}: AlertProps) {
  const [visible, setVisible] = useState(true);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const cfg = variantConfig[variant];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={`card flex items-start gap-3 ${cfg.border} ${cfg.bg} ${className}`}
        >
          {/* Icon */}
          <cfg.Icon
            className={`mt-0.5 h-4 w-4 flex-shrink-0 ${cfg.iconColor}`}
          />

          {/* Content */}
          <div className="min-w-0 flex-1">
            {title && (
              <div className={`text-sm font-medium ${cfg.text}`}>{title}</div>
            )}
            <p
              className={`text-xs leading-relaxed ${
                title ? "mt-1 text-[var(--text-secondary)]" : cfg.text
              }`}
            >
              {message}
            </p>
          </div>

          {/* Close button */}
          {dismissible && (
            <button
              onClick={handleDismiss}
              className="ml-2 flex-shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              aria-label="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
