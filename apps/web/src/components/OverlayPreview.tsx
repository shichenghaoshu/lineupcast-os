"use client";

import type { ReactNode } from "react";

interface OverlayPreviewProps {
  aspect: "16:9" | "9:16";
  children: ReactNode;
  label: string;
}

export function OverlayPreview({ aspect, children, label }: OverlayPreviewProps) {
  const aspectClass = aspect === "16:9" ? "aspect-video" : "aspect-[9/16]";

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`${aspectClass} relative w-full overflow-hidden rounded-lg border border-[var(--border-color)] bg-black`}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      </div>
    </div>
  );
}
