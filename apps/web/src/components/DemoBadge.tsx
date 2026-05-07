"use client";

import { Info } from "lucide-react";

interface DemoBadgeProps {
  /** Optional extra message shown alongside the badge label. */
  message?: string;
}

/**
 * Small pill that indicates the current page is displaying mock / demo data
 * because the LineupCast API was unreachable or returned an error.
 */
export function DemoBadge({ message }: DemoBadgeProps) {
  const tooltip =
    message ??
    "The API was unreachable, so demo data is shown. Start the backend to see live data.";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-amber)]/40 bg-[var(--accent-amber)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent-amber)]"
      title={tooltip}
    >
      <Info className="h-3 w-3" />
      Demo Data
    </span>
  );
}
