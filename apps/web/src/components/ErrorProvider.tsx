"use client";

import { useEffect } from "react";
import { initErrorTracking } from "@/lib/error-tracking";
import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Client-side wrapper that:
 *  1. Initialises global error/rejection handlers on first mount.
 *  2. Wraps children in a React ErrorBoundary.
 */
export function ErrorProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initErrorTracking();
  }, []);

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
