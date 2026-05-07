"use client";

import { useState, useEffect } from "react";
import {
  type CoreWebVitals,
  type ApiLatencyEntry,
  type PerformanceMetric,
  getPerformanceSnapshot,
  onMetricsChange,
  observeWebVitals,
  collectPageLoadMetrics,
  clearMetrics,
} from "@/lib/performance";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function vitalColor(metric: string, value: number | null): string {
  if (value === null) return "#6b7280"; // gray = no data
  const thresholds: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    fid: [100, 300],
    cls: [0.1, 0.25],
    ttfb: [800, 1800],
    inp: [200, 500],
  };
  const [good, poor] = thresholds[metric] ?? [0, 0];
  if (value <= good) return "#22c55e"; // green
  if (value <= poor) return "#eab308"; // yellow
  return "#ef4444"; // red
}

function formatValue(metric: string, value: number | null): string {
  if (value === null) return "--";
  if (metric === "cls") return value.toFixed(3);
  return `${value}ms`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VitalBadge({ label, metric, value }: { label: string; metric: string; value: number | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-gray-400">{label}</span>
      <span
        className="text-sm font-mono font-semibold"
        style={{ color: vitalColor(metric, value) }}
      >
        {formatValue(metric, value)}
      </span>
    </div>
  );
}

function ApiTable({ entries }: { entries: ApiLatencyEntry[] }) {
  // Show the 8 most recent entries
  const recent = entries.slice(-8).reverse();
  if (recent.length === 0) {
    return <p className="text-gray-500 text-xs italic">No API calls recorded yet.</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-400 text-left">
          <th className="pb-1 pr-2">Method</th>
          <th className="pb-1 pr-2">Path</th>
          <th className="pb-1 pr-2 text-right">Status</th>
          <th className="pb-1 text-right">Latency</th>
        </tr>
      </thead>
      <tbody>
        {recent.map((e, i) => (
          <tr key={i} className="border-t border-gray-800">
            <td className="py-0.5 pr-2 font-mono text-gray-300">{e.method}</td>
            <td className="py-0.5 pr-2 font-mono text-gray-300 truncate max-w-[140px]">{e.path}</td>
            <td
              className="py-0.5 pr-2 text-right font-mono"
              style={{ color: e.status >= 400 ? "#ef4444" : "#22c55e" }}
            >
              {e.status}
            </td>
            <td className="py-0.5 text-right font-mono text-gray-300">{e.latencyMs}ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PageLoadTable({ metrics }: { metrics: PerformanceMetric[] }) {
  if (metrics.length === 0) {
    return <p className="text-gray-500 text-xs italic">No page load data yet.</p>;
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-gray-400 text-left">
          <th className="pb-1 pr-2">Metric</th>
          <th className="pb-1 text-right">Value</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((m, i) => (
          <tr key={i} className="border-t border-gray-800">
            <td className="py-0.5 pr-2 font-mono text-gray-300">{m.name}</td>
            <td className="py-0.5 text-right font-mono text-gray-300">
              {m.value}{m.unit === "ms" ? "ms" : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Main overlay component
// ---------------------------------------------------------------------------

export function PerformanceMonitor() {
  const [visible, setVisible] = useState(false);
  const [vitals, setVitals] = useState<CoreWebVitals>({ lcp: null, fid: null, cls: null, ttfb: null, inp: null });
  const [apiEntries, setApiEntries] = useState<ApiLatencyEntry[]>([]);
  const [pageMetrics, setPageMetrics] = useState<PerformanceMetric[]>([]);
  const [tab, setTab] = useState<"vitals" | "api" | "pageload">("vitals");

  // Initialize observers and collect initial data
  useEffect(() => {
    if (typeof window === "undefined") return;

    observeWebVitals();
    collectPageLoadMetrics();

    const sync = () => {
      const snap = getPerformanceSnapshot();
      setVitals(snap.webVitals);
      setApiEntries(snap.apiLatency);
      setPageMetrics(snap.pageLoad);
    };

    sync();
    const unsub = onMetricsChange(sync);
    return unsub;
  }, []);

  // Keyboard shortcut: Ctrl+Shift+P to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Only render in development
  if (process.env.NODE_ENV !== "development") return null;

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-[9999] bg-gray-900/90 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded-md hover:bg-gray-800 transition-colors font-mono"
        title="Open Performance Monitor (Ctrl+Shift+P)"
      >
        PERF
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-gray-950/95 backdrop-blur border border-gray-700 rounded-lg shadow-2xl text-gray-200 font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-900/80">
        <span className="font-semibold text-gray-100">Performance Monitor</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              clearMetrics();
              collectPageLoadMetrics();
            }}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Clear metrics"
          >
            Clear
          </button>
          <button
            onClick={() => setVisible(false)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Close (Ctrl+Shift+P)"
          >
            X
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(["vitals", "api", "pageload"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-center text-[11px] uppercase tracking-wider transition-colors ${
              tab === t
                ? "text-white border-b-2 border-blue-400 bg-gray-900/50"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "vitals" ? "Web Vitals" : t === "api" ? "API" : "Page Load"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-3 max-h-64 overflow-y-auto">
        {tab === "vitals" && (
          <div className="grid grid-cols-5 gap-2">
            <VitalBadge label="LCP" metric="lcp" value={vitals.lcp} />
            <VitalBadge label="FID" metric="fid" value={vitals.fid} />
            <VitalBadge label="CLS" metric="cls" value={vitals.cls} />
            <VitalBadge label="TTFB" metric="ttfb" value={vitals.ttfb} />
            <VitalBadge label="INP" metric="inp" value={vitals.inp} />
          </div>
        )}

        {tab === "api" && <ApiTable entries={apiEntries} />}

        {tab === "pageload" && <PageLoadTable metrics={pageMetrics} />}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-800 text-[10px] text-gray-600 text-center">
        Ctrl+Shift+P to toggle
      </div>
    </div>
  );
}

export default PerformanceMonitor;
