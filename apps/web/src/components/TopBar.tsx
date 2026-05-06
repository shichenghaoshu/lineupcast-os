"use client";

import { Bell, Settings, Wifi } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-6">
      <div>
        <h1 className="text-base font-semibold">{title}</h1>
        {subtitle && (
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="badge-green flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          OBS Ready
        </span>
        <button className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]">
          <Bell className="h-4 w-4" />
        </button>
        <button className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
