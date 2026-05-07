/**
 * Centralized animation variants and utilities for framer-motion.
 *
 * Import these in any component that needs motion:
 *
 *   import { pageVariants, cardHover, staggerContainer } from "@/lib/animations";
 *
 * The project already depends on framer-motion ^11.18.0.
 */

import type { Variants, Transition } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Shared easing presets                                              */
/* ------------------------------------------------------------------ */

export const easeOut = [0.25, 0.46, 0.45, 0.94] as const;
export const easeInOut = [0.42, 0, 0.58, 1] as const;
export const springSnappy: Transition = {
  type: "spring",
  damping: 25,
  stiffness: 300,
};

/* ------------------------------------------------------------------ */
/*  1. Page transition variants                                        */
/* ------------------------------------------------------------------ */

/**
 * Wrap a page-level container with these variants so route changes feel
 * smooth.  Works with AnimatePresence in the layout.
 *
 * Usage:
 *   <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
 */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
    filter: "blur(4px)",
  },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.35,
      ease: easeOut as unknown as number[],
      when: "beforeChildren",
      staggerChildren: 0.06,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: "blur(4px)",
    transition: {
      duration: 0.2,
      ease: easeOut as unknown as number[],
    },
  },
};

/* ------------------------------------------------------------------ */
/*  2. Card hover effects                                              */
/* ------------------------------------------------------------------ */

/**
 * Standard card hover / tap effect.  Apply as motion props:
 *
 *   <motion.div {...cardHover} className="card">
 *
 * Or with variants:
 *   <motion.div variants={cardHoverVariants} whileHover="hover" whileTap="tap">
 */
export const cardHoverVariants: Variants = {
  idle: {
    scale: 1,
    y: 0,
    boxShadow: "0 1px 3px rgba(0,0,0,0)",
  },
  hover: {
    scale: 1.015,
    y: -3,
    boxShadow: "0 8px 25px rgba(0,0,0,0.12)",
    transition: {
      type: "spring",
      damping: 20,
      stiffness: 260,
    },
  },
  tap: {
    scale: 0.985,
    y: 0,
    transition: { duration: 0.1 },
  },
};

/** Inline prop bag for quick usage without variants. */
export const cardHover = {
  whileHover: {
    scale: 1.015,
    y: -3,
    transition: { type: "spring", damping: 20, stiffness: 260 },
  },
  whileTap: { scale: 0.985, y: 0, transition: { duration: 0.1 } },
} as const;

/** Subtler hover for compact / list items (e.g. PlayerCard compact). */
export const cardHoverSubtle = {
  whileHover: {
    scale: 1.01,
    transition: { type: "spring", damping: 22, stiffness: 300 },
  },
  whileTap: { scale: 0.99 },
} as const;

/* ------------------------------------------------------------------ */
/*  3. Number counter animation (framer-motion)                        */
/* ------------------------------------------------------------------ */

/**
 * Variant for animating a number that appears inside a motion component.
 * Use with useMotionValue + useTransform for raw numbers, or simply apply
 * the fade-up entrance:
 *
 *   <motion.span variants={numberPop} className="tabular-nums">{value}</motion.span>
 */
export const numberPop: Variants = {
  initial: { opacity: 0, scale: 0.7, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      damping: 15,
      stiffness: 200,
    },
  },
};

/**
 * Pre-configured transition for a counting-up number (used with
 * useAnimatedCounter or manual RAF).
 */
export const counterTransition: Transition = {
  duration: 1.2,
  ease: [0.25, 0.46, 0.45, 0.94],
};

/* ------------------------------------------------------------------ */
/*  4. Progress bar animation                                          */
/* ------------------------------------------------------------------ */

/**
 * Variant for animated progress bars / probability bars.
 * The "animate" state should receive a `width` value via style or
 * animate prop override.
 *
 * Usage:
 *   <motion.div
 *     variants={progressBarVariants}
 *     initial="initial"
 *     animate="animate"
 *     style={{ width: `${percentage}%` }}
 *   />
 */
export const progressBarVariants: Variants = {
  initial: {
    scaleX: 0,
    originX: 0,
  },
  animate: {
    scaleX: 1,
    transition: {
      duration: 0.8,
      ease: easeOut as unknown as number[],
    },
  },
};

/**
 * Preset for a progress bar that fills from left to right with a slight
 * overshoot bounce.  Use when the bar width is set via animate prop:
 *
 *   <motion.div animate={{ width: `${pct}%` }} transition={progressBarSpring} />
 */
export const progressBarSpring: Transition = {
  type: "spring",
  damping: 18,
  stiffness: 120,
};

/**
 * Framer-motion animate props for a bar that reveals its width on mount.
 * Pass the target percentage via the `width` key.
 *
 *   <motion.div {...progressBarAnimate(75)} className="h-2 rounded-full bg-green-500" />
 */
export function progressBarAnimate(percentage: number) {
  return {
    initial: { width: 0 },
    animate: { width: `${percentage}%` },
    transition: { duration: 0.8, ease: easeOut as unknown as number[] },
  };
}

/* ------------------------------------------------------------------ */
/*  5. Stagger children animation                                      */
/* ------------------------------------------------------------------ */

/**
 * Container variant that staggers its children.
 * Children should use `variants={staggerChild}` or any other variant
 * with an `initial`/`animate` pair.
 *
 * Usage:
 *   <motion.div variants={staggerContainer} initial="initial" animate="animate">
 *     {items.map(item => (
 *       <motion.div key={item.id} variants={staggerChild}>...</motion.div>
 *     ))}
 *   </motion.div>
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

/** Faster stagger for dense lists (player cards, match lists). */
export const staggerContainerFast: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

/** Slow stagger for hero sections or fewer items. */
export const staggerContainerSlow: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

/**
 * Default child variant to pair with staggerContainer.
 * Items fade up and into place one by one.
 */
export const staggerChild: Variants = {
  initial: {
    opacity: 0,
    y: 16,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: easeOut as unknown as number[],
    },
  },
};

/** Child variant with a slight scale pop (good for KPI cards). */
export const staggerChildPop: Variants = {
  initial: {
    opacity: 0,
    y: 14,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 18,
      stiffness: 200,
    },
  },
};

/* ------------------------------------------------------------------ */
/*  6. Misc reusable presets                                           */
/* ------------------------------------------------------------------ */

/** Fade-in from below (simple entrance). */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOut as unknown as number[] },
  },
};

/** Crossfade (opacity only). */
export const crossfade: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

/** Slide in from left (mobile sidebar, drawers). */
export const slideInLeft: Variants = {
  initial: { x: "-100%" },
  animate: { x: 0, transition: springSnappy as Transition },
  exit: { x: "-100%", transition: { duration: 0.2 } },
};

/** Slide in from right. */
export const slideInRight: Variants = {
  initial: { x: "100%" },
  animate: { x: 0, transition: springSnappy as Transition },
  exit: { x: "100%", transition: { duration: 0.2 } },
};

/** Live match pulse (reusable for any live indicator). */
export const livePulse: Variants = {
  animate: {
    opacity: [0.3, 0.8, 0.3],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};
