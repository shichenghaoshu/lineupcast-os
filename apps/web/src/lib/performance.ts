/**
 * Performance monitoring utilities for LineupCast OS.
 *
 * Tracks page load timing, API call latency, component render durations,
 * and Core Web Vitals (LCP, FID, CLS, TTFB, INP).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "score" | "bytes";
  timestamp: number;
  tags?: Record<string, string>;
}

export interface ApiLatencyEntry {
  path: string;
  method: string;
  status: number;
  latencyMs: number;
  timestamp: number;
}

export interface ComponentRenderEntry {
  component: string;
  phase: "mount" | "update";
  durationMs: number;
  timestamp: number;
}

export interface CoreWebVitals {
  lcp: number | null;   // Largest Contentful Paint (ms)
  fid: number | null;   // First Input Delay (ms)
  cls: number | null;   // Cumulative Layout Shift (score)
  ttfb: number | null;  // Time to First Byte (ms)
  inp: number | null;   // Interaction to Next Paint (ms)
}

export interface PerformanceSnapshot {
  pageLoad: PerformanceMetric[];
  apiLatency: ApiLatencyEntry[];
  componentRender: ComponentRenderEntry[];
  webVitals: CoreWebVitals;
}

// ---------------------------------------------------------------------------
// In-memory stores (capped to avoid unbounded growth)
// ---------------------------------------------------------------------------

const MAX_PAGE_METRICS = 200;
const MAX_API_ENTRIES = 300;
const MAX_RENDER_ENTRIES = 300;

const pageMetrics: PerformanceMetric[] = [];
const apiLatencies: ApiLatencyEntry[] = [];
const renderEntries: ComponentRenderEntry[] = [];
const webVitals: CoreWebVitals = { lcp: null, fid: null, cls: null, ttfb: null, inp: null };

// Subscribers for live updates (used by the overlay)
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) fn();
}

/** Subscribe to metric changes. Returns an unsubscribe function. */
export function onMetricsChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------------------------------------------------------------------------
// Page load time tracking
// ---------------------------------------------------------------------------

/**
 * Collect Navigation Timing / Paint Timing metrics for the current page.
 * Safe to call in the browser only. Metrics are pushed into the shared store
 * and listeners are notified.
 */
export function collectPageLoadMetrics(): void {
  if (typeof window === "undefined") return;

  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    pushPageMetric("dns", nav.domainLookupEnd - nav.domainLookupStart);
    pushPageMetric("tcp", nav.connectEnd - nav.connectStart);
    pushPageMetric("ttfb", nav.responseStart - nav.requestStart);
    pushPageMetric("download", nav.responseEnd - nav.responseStart);
    pushPageMetric("dom_interactive", nav.domInteractive - nav.startTime);
    pushPageMetric("dom_complete", nav.domComplete - nav.startTime);
    pushPageMetric("load", nav.loadEventEnd - nav.startTime);

    // Also record TTFB for web vitals
    webVitals.ttfb = nav.responseStart - nav.startTime;
  }

  const paintEntries = performance.getEntriesByType("paint");
  for (const entry of paintEntries) {
    pushPageMetric(entry.name.replace(/-/g, "_"), entry.startTime);
  }

  notify();
}

function pushPageMetric(name: string, value: number) {
  if (pageMetrics.length >= MAX_PAGE_METRICS) pageMetrics.shift();
  pageMetrics.push({ name, value: Math.round(value), unit: "ms", timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// API call latency tracking
// ---------------------------------------------------------------------------

/**
 * Record an API call's latency. Called by the instrumented `requestJson` wrapper.
 */
export function recordApiLatency(entry: ApiLatencyEntry): void {
  if (apiLatencies.length >= MAX_API_ENTRIES) apiLatencies.shift();
  apiLatencies.push(entry);
  notify();
}

/** Return a shallow copy of the recorded API latencies. */
export function getApiLatencies(): ApiLatencyEntry[] {
  return [...apiLatencies];
}

/** Return average latency (ms) for a given path, or null if no data. */
export function averageApiLatency(path: string): number | null {
  const matching = apiLatencies.filter((e) => e.path === path);
  if (matching.length === 0) return null;
  return Math.round(matching.reduce((sum, e) => sum + e.latencyMs, 0) / matching.length);
}

// ---------------------------------------------------------------------------
// Component render time tracking
// ---------------------------------------------------------------------------

/**
 * Record a component render duration. Typically called from `useRenderTime`.
 */
export function recordComponentRender(entry: ComponentRenderEntry): void {
  if (renderEntries.length >= MAX_RENDER_ENTRIES) renderEntries.shift();
  renderEntries.push(entry);
  notify();
}

/** Return a shallow copy of the recorded component renders. */
export function getComponentRenders(): ComponentRenderEntry[] {
  return [...renderEntries];
}

// ---------------------------------------------------------------------------
// Core Web Vitals (LCP, FID, CLS, INP)
// ---------------------------------------------------------------------------

/**
 * Observe Core Web Vitals using the browser PerformanceObserver API.
 * Safe to call multiple times; duplicate observers are avoided.
 */
let webVitalsInitialized = false;

export function observeWebVitals(): void {
  if (typeof window === "undefined" || webVitalsInitialized) return;
  webVitalsInitialized = true;

  // Largest Contentful Paint
  try {
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        webVitals.lcp = Math.round(last.startTime);
        notify();
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    // PerformanceObserver type not supported
  }

  // First Input Delay
  try {
    const fidObserver = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0] as PerformanceEventTiming | undefined;
      if (entry) {
        webVitals.fid = Math.round(entry.processingStart - entry.startTime);
        notify();
      }
    });
    fidObserver.observe({ type: "first-input", buffered: true });
  } catch {
    // PerformanceObserver type not supported
  }

  // Cumulative Layout Shift
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as LayoutShift).hadRecentInput) {
          clsValue += (entry as LayoutShift).value;
        }
      }
      webVitals.cls = Math.round(clsValue * 1000) / 1000;
      notify();
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });
  } catch {
    // PerformanceObserver type not supported
  }

  // Interaction to Next Paint (via event timing entries)
  try {
    let maxINP = 0;
    const inpObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const evt = entry as PerformanceEventTiming;
        if (evt.interactionId) {
          const duration = evt.duration;
          if (duration > maxINP) {
            maxINP = duration;
            webVitals.inp = Math.round(maxINP);
            notify();
          }
        }
      }
    });
    inpObserver.observe({ type: "event", buffered: true, durationThreshold: 40 });
  } catch {
    // PerformanceObserver type not supported
  }
}

/** Return the current Core Web Vitals snapshot. */
export function getWebVitals(): CoreWebVitals {
  return { ...webVitals };
}

// ---------------------------------------------------------------------------
// Full snapshot
// ---------------------------------------------------------------------------

/** Return a combined snapshot of every tracked metric category. */
export function getPerformanceSnapshot(): PerformanceSnapshot {
  return {
    pageLoad: [...pageMetrics],
    apiLatency: [...apiLatencies],
    componentRender: [...renderEntries],
    webVitals: { ...webVitals },
  };
}

/** Clear all stored metrics (useful for development/testing). */
export function clearMetrics(): void {
  pageMetrics.length = 0;
  apiLatencies.length = 0;
  renderEntries.length = 0;
  webVitals.lcp = null;
  webVitals.fid = null;
  webVitals.cls = null;
  webVitals.ttfb = null;
  webVitals.inp = null;
  notify();
}

// ---------------------------------------------------------------------------
// React hook for component render timing
// ---------------------------------------------------------------------------
// The actual `useRenderTime` hook is exported from "./performance-hooks" (a
// "use client" module). Import it directly in component files:
//
//   import { useRenderTime } from "@/lib/performance-hooks";
//
// This module does not re-export the hook to avoid pulling React into
// non-client modules.
