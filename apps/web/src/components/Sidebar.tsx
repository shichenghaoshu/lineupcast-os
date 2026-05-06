"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  FileText,
  Monitor,
  Database,
  Target,
  LogIn,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "数据驾驶舱", icon: LayoutDashboard },
  { href: "/lineup", label: "阵容战术板", icon: Users },
  { href: "/prediction", label: "胜率推演", icon: Target },
  { href: "/script", label: "AI 口播稿", icon: FileText },
  { href: "/overlay", label: "OBS 覆盖层", icon: Monitor },
  { href: "/data", label: "数据源", icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="flex h-14 items-center gap-2 border-b border-[var(--border-color)] px-4">
        <TrendingUp className="h-6 w-6 text-[var(--accent-green)]" />
        <span className="text-lg font-bold tracking-tight">LineupCast</span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border-color)] p-3">
        <Link
          href="/login"
          className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
        >
          <LogIn className="h-3.5 w-3.5" />
          登录 / 切换账户
        </Link>
      </div>
    </aside>
  );
}
