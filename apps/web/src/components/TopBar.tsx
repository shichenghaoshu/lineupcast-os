"use client";

import { Bell, Settings, Wifi } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 md:px-6">
      <div className="pl-12 md:pl-0 min-w-0 flex-1 mr-2">
        <h1 className="text-sm sm:text-base font-semibold truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        <span className="badge-green hidden sm:flex items-center gap-1">
          <Wifi className="h-3 w-3" />
          OBS Ready
        </span>
        <span className="badge-green sm:hidden flex items-center gap-1">
          <Wifi className="h-3 w-3" />
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
