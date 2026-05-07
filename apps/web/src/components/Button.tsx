"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  /** When true the icon is placed after the children */
  iconRight?: boolean;
  /** Render as a full-width block button */
  fullWidth?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                        */
/* ------------------------------------------------------------------ */

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/80",
  secondary:
    "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]",
  danger:
    "text-[var(--accent-red)] hover:bg-red-500/10",
  ghost:
    "text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "rounded px-2 py-1 text-xs gap-1",
  md: "rounded-md px-3 py-2 text-sm gap-2",
  lg: "rounded-lg px-5 py-2.5 text-base gap-2.5",
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    iconRight = false,
    fullWidth = false,
    disabled,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  const classes = [
    // base
    "inline-flex items-center justify-center font-medium transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)]/30",
    "disabled:cursor-not-allowed disabled:opacity-60",
    // variant
    variantClasses[variant],
    // size
    sizeClasses[size],
    // full width
    fullWidth ? "w-full" : "",
    // user overrides
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const spinner = (
    <Loader2
      className={`${size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} animate-spin`}
    />
  );

  const iconNode = icon && !loading ? (
    <span className="flex-shrink-0">{icon}</span>
  ) : null;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={classes}
      {...rest}
    >
      {loading && !iconRight && spinner}
      {!loading && !iconRight && iconNode}
      {children && <span>{children}</span>}
      {loading && iconRight && spinner}
      {!loading && iconRight && iconNode}
    </button>
  );
});

export { Button, type ButtonProps, type ButtonVariant, type ButtonSize };
