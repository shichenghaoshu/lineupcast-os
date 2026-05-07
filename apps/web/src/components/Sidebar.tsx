"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  FileText,
  Monitor,
  Database,
  Target,
  LogIn,
  Menu,
  X,
  UserCog,
  History,
} from "lucide-react";
import { LeagueSelector } from "./LeagueSelector";
import { leagues } from "@/lib/mock-data";

const navItems = [
  { href: "/dashboard", label: "数据驾驶舱", icon: LayoutDashboard },
  { href: "/lineup", label: "阵容战术板", icon: Users },
  { href: "/prediction", label: "胜率推演", icon: Target },
  { href: "/predictions", label: "预测记录", icon: History },
  { href: "/script", label: "AI 口播稿", icon: FileText },
  { href: "/overlay", label: "OBS 覆盖层", icon: Monitor },
  { href: "/data", label: "数据源", icon: Database },
  { href: "/users", label: "用户管理", icon: UserCog },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    onNavigate?.();
  }, [pathname, onNavigate]);

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-[var(--border-color)] px-4">
        <TrendingUp className="h-6 w-6 text-[var(--accent-green)]" />
        <span className="text-lg font-bold tracking-tight">LineupCast</span>
      </div>

      <div className="border-b border-[var(--border-color)] px-2 py-2">
        <LeagueSelector leagues={leagues} />
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
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-md bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden md:flex h-screen w-56 flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 md:hidden"
              onClick={closeMobile}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)] md:hidden"
            >
              <div className="flex items-center justify-end p-2">
                <button
                  onClick={closeMobile}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-card)]"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent onNavigate={closeMobile} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
