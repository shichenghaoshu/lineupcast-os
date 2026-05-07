"use client";

import { useRef, useEffect } from "react";
import { recordComponentRender } from "./performance";

/**
 * React hook that measures the time a component spends rendering (mount + updates).
 *
 * Usage:
 *   "use client";
 *   import { useRenderTime } from "@/lib/performance-hooks";
 *
 *   function MyComponent() {
 *     useRenderTime("MyComponent");
 *     return <div>...</div>;
 *   }
 */
export function useRenderTime(componentName: string): void {
  const mountTime = useRef<number>(0);
  const isMount = useRef(true);

  // Mark start of render
  const renderStart = typeof performance !== "undefined" ? performance.now() : 0;

  useEffect(() => {
    const durationMs = typeof performance !== "undefined"
      ? Math.round(performance.now() - renderStart)
      : 0;

    recordComponentRender({
      component: componentName,
      phase: isMount.current ? "mount" : "update",
      durationMs,
      timestamp: Date.now(),
    });

    if (isMount.current) {
      mountTime.current = Date.now();
      isMount.current = false;
    }
  });

  // We intentionally run on every render to capture update durations.
  // The effect has no dependency array so it fires after every paint.
}
