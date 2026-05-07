"use client";

import { motion } from "framer-motion";
import type { ReactNode, MouseEventHandler } from "react";
import { fadeInUp, cardHover } from "@/lib/animations";

/* ------------------------------------------------------------------ */
/*  Card.Header                                                       */
/* ------------------------------------------------------------------ */

function CardHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card.Body                                                         */
/* ------------------------------------------------------------------ */

function CardBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/*  Card.Footer                                                       */
/* ------------------------------------------------------------------ */

function CardFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-3 flex items-center justify-between border-t border-[var(--border-color)] pt-3 ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card (root)                                                       */
/* ------------------------------------------------------------------ */

export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Enable hover background + scale effect */
  hoverable?: boolean;
  /** Click handler; makes the card act as a button */
  onClick?: MouseEventHandler<HTMLDivElement>;
  /** Custom hover shadow color (e.g. "emerald", "blue", "amber", "purple") */
  hoverShadow?: "blue" | "green" | "amber" | "purple" | "red";
}

const shadowColorMap: Record<string, string> = {
  blue: "hover:shadow-blue-500/10",
  green: "hover:shadow-emerald-500/10",
  amber: "hover:shadow-amber-500/10",
  purple: "hover:shadow-purple-500/10",
  red: "hover:shadow-red-500/10",
};

function CardRoot({
  children,
  className = "",
  hoverable = false,
  onClick,
  hoverShadow,
}: CardProps) {
  const base = hoverable ? "card-hover" : "card";
  const shadow = hoverShadow ? shadowColorMap[hoverShadow] ?? "" : "";
  const clickable = onClick
    ? "cursor-pointer transition-shadow duration-300 hover:shadow-lg"
    : "";

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      {...(hoverable ? cardHover : {})}
      onClick={onClick}
      className={`${base} ${shadow} ${clickable} ${className}`.trim()}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Compound export                                                   */
/* ------------------------------------------------------------------ */

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});
