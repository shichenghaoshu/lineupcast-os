"use client";

import { useState, useCallback } from "react";
import { Download, ChevronDown, Loader2, Check, AlertCircle } from "lucide-react";
import { apiUrl } from "@/lib/api-client";

export type ExportFormat = "predictions-csv" | "scripts-json" | "overlays-zip" | "full-zip";

interface ExportOption {
  key: ExportFormat;
  label: string;
  description: string;
  endpoint: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    key: "predictions-csv",
    label: "Predictions (CSV)",
    description: "All prediction records with probabilities and confidence",
    endpoint: "/api/export/predictions",
  },
  {
    key: "scripts-json",
    label: "Scripts (JSON)",
    description: "Generated commentary scripts with metadata",
    endpoint: "/api/export/scripts",
  },
  {
    key: "overlays-zip",
    label: "Overlays (ZIP)",
    description: "OBS overlay scenes as HTML files",
    endpoint: "/api/export/overlays",
  },
  {
    key: "full-zip",
    label: "Full Backup (ZIP)",
    description: "Complete data backup: matches, predictions, scripts, overlays",
    endpoint: "/api/export/full",
  },
];

type ExportStatus = "idle" | "downloading" | "success" | "error";

interface ExportButtonProps {
  /** Show only a specific subset of export options */
  allowedFormats?: ExportFormat[];
  /** Match ID to scope exports to (used by predictions and overlays) */
  matchId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode: icon-only button that opens a dropdown */
  compact?: boolean;
}

export function ExportButton({
  allowedFormats,
  matchId,
  className = "",
  compact = false,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [activeFormat, setActiveFormat] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = allowedFormats
    ? EXPORT_OPTIONS.filter((opt) => allowedFormats.includes(opt.key))
    : EXPORT_OPTIONS;

  const handleExport = useCallback(
    async (option: ExportOption) => {
      setStatus("downloading");
      setActiveFormat(option.key);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (matchId && (option.key === "predictions-csv" || option.key === "overlays-zip")) {
          params.set("match_id", matchId);
        }
        const queryString = params.toString();
        const url = apiUrl(option.endpoint + (queryString ? `?${queryString}` : ""));

        const response = await fetch(url);
        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(errorText || `Export failed (${response.status})`);
        }

        // Trigger file download
        const blob = await response.blob();
        const contentDisposition = response.headers.get("Content-Disposition") || "";
        const filenameMatch = contentDisposition.match(/filename="?([^";\n]+)"?/);
        const filename = filenameMatch ? filenameMatch[1] : `lineupcast_export_${option.key}`;

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);

        setStatus("success");
        setTimeout(() => {
          setStatus("idle");
          setActiveFormat(null);
          setOpen(false);
        }, 2000);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Export failed");
        setTimeout(() => {
          setStatus("idle");
          setActiveFormat(null);
          setError(null);
        }, 4000);
      }
    },
    [matchId],
  );

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        disabled={status === "downloading"}
        className={`flex items-center gap-2 rounded-md border border-[var(--border-color)] px-3 py-2 text-xs font-medium transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60 ${
          status === "success"
            ? "border-[var(--accent-green)] text-[var(--accent-green)]"
            : status === "error"
              ? "border-[var(--accent-red)] text-[var(--accent-red)]"
              : "text-[var(--text-muted)]"
        }`}
      >
        {status === "downloading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === "success" ? (
          <Check className="h-3.5 w-3.5" />
        ) : status === "error" ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {compact ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <>
            {status === "downloading"
              ? "Exporting..."
              : status === "success"
                ? "Downloaded!"
                : status === "error"
                  ? "Failed"
                  : "Export Data"}
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && status === "idle" && (
        <>
          {/* Backdrop to close dropdown */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg">
            <div className="border-b border-[var(--border-color)] px-3 py-2">
              <div className="text-xs font-medium text-[var(--text-primary)]">
                Export Format
              </div>
              <div className="text-[10px] text-[var(--text-muted)]">
                Select a format to download
              </div>
            </div>
            <div className="p-1">
              {options.map((option) => (
                <button
                  key={option.key}
                  onClick={() => handleExport(option)}
                  className="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left transition-colors hover:bg-[var(--bg-card)]"
                >
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    {option.label}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Progress/status bar */}
      {status === "downloading" && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 shadow-lg">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent-blue)]" />
            <span>
              Preparing {activeFormat?.replace("-", " ").replace(/^(predictions|scripts|overlays|full)\s?/, "") || "file"}...
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-primary)]">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--accent-blue)]" />
          </div>
        </div>
      )}

      {/* Error toast */}
      {status === "error" && error && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-[var(--accent-red)]/30 bg-[var(--accent-red)]/5 p-2 shadow-lg">
          <div className="flex items-start gap-2 text-[10px] text-[var(--accent-red)]">
            <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span className="line-clamp-3">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
