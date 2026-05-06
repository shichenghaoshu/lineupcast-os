"use client";

import { motion } from "framer-motion";
import { Github, Mail, Play, TrendingUp, Brain, BarChart3, Crosshair } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl space-y-8 px-6"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <TrendingUp className="h-10 w-10 text-[var(--accent-green)]" />
          <span className="text-3xl font-bold tracking-tight">LineupCast OS</span>
        </div>

        {/* Main heading */}
        <div className="space-y-3 text-center">
          <h1 className="text-2xl font-bold leading-tight">
            把首发名单变成赛前解说数据驾驶舱
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-[var(--text-secondary)]">
            自动导入阵容、生成球员资料卡、胜率推演、可能进球人、红黄牌风险，并输出可直接朗读的中文口播稿。
          </p>
        </div>

        {/* Model tags */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[
            { icon: Brain, label: "Dixon-Coles", color: "badge-purple" },
            { icon: BarChart3, label: "xG + VAEP", color: "badge-blue" },
            { icon: Crosshair, label: "xB Model", color: "badge-green" },
          ].map((tag) => (
            <span key={tag.label} className={`${tag.color} flex items-center gap-1.5 px-3 py-1`}>
              <tag.icon className="h-3.5 w-3.5" />
              {tag.label}
            </span>
          ))}
        </div>

        {/* Login buttons */}
        <div className="space-y-3">
          <button className="flex w-full items-center justify-center gap-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--bg-card-hover)]">
            <Github className="h-5 w-5" />
            GitHub 登录
          </button>
          <button className="flex w-full items-center justify-center gap-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[var(--bg-card-hover)]">
            <Mail className="h-5 w-5" />
            邮箱登录
          </button>
          <button className="flex w-full items-center justify-center gap-3 rounded-lg bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/30 px-4 py-3 text-sm font-medium text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)]/20">
            <Play className="h-5 w-5" />
            本地 Demo
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[var(--text-muted)]">
          开源赛前解说数据驾驶舱 · 非博彩工具
        </p>
      </motion.div>
    </div>
  );
}
