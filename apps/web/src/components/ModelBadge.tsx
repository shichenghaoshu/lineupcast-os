"use client";

interface ModelBadgeProps {
  name: string;
  version?: string;
  confidence?: number;
}

export function ModelBadge({ name, version, confidence }: ModelBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] px-2 py-1">
      <span className="badge-purple text-[10px]">{name}</span>
      {version && (
        <span className="text-[10px] text-[var(--text-muted)]">v{version}</span>
      )}
      {confidence !== undefined && (
        <span className="text-[10px] font-medium tabular-nums text-[var(--accent-green)]">
          {confidence}%
        </span>
      )}
    </div>
  );
}
