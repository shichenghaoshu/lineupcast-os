"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Animates a number from 0 (or `from`) to `to` over `duration` ms.
 * Returns the current interpolated value.
 */
export function useAnimatedCounter(
  to: number,
  duration = 1200,
  from = 0,
): number {
  const [value, setValue] = useState(from);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset when target changes
    setValue(from);
    startTimeRef.current = null;

    function tick(now: number) {
      if (startTimeRef.current === null) startTimeRef.current = now;
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (to - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, duration]);

  return value;
}
