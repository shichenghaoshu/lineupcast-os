"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// ── Supported languages ──────────────────────────────────────────────

export type Lang = "zh" | "en";

const STORAGE_KEY = "lineupcast-lang";

// ── Translation dictionaries ─────────────────────────────────────────

const zh = {
  // Navigation
  nav: {
    dashboard: "数据驾驶舱",
    match: "赛事中心",
    lineup: "阵容战术板",
    prediction: "胜率推演",
    script: "AI 口播稿",
    overlay: "OBS 覆盖层",
    compare: "球员对比",
    stats: "比赛统计",
    data: "数据源",
    apiSettings: "API 配置",
    workspace: "工作区设置",
    predictions: "预测记录",
    login: "登录 / 切换账户",
  },

  // Dashboard
  dashboard: {
    title: "数据驾驶舱",
    loading: "加载中...",
    lineupIntegrity: "阵容完整度",
    scriptReady: "口播稿就绪",
    predictionConfidence: "预测置信度",
    obsStatus: "OBS 状态",
    trend: "趋势",
    lineupPreview: "阵容预览",
    aiSummary: "AI 赛前摘要",
    predictionSummary: "预测摘要",
    last5Trend: "近5场趋势",
    expectedGoals: "预期进球",
    keyPlayers: "关键球员",
    possibleScorers: "可能进球人",
    yellowCardRisks: "黄牌风险",
    aiSummaryText: (home: string, winPct: number, confPct: number) =>
      `${home} 近期状态出色，连续3场取胜。Dixon-Coles模型预测主队胜率${winPct}%，阵容调整后置信度提升至${confPct}%。`,
  },

  // Lineup page
  lineup: {
    title: "阵容战术板",
    formation: "阵型",
    tacticalInsights: "战术洞察",
    starters: "首发球员",
    bench: "替补球员",
    injuries: "伤病名单",
    loading: "加载阵容...",
    playerStats: "球员数据统计",
    playerStatsSubtitle: (starters: number, bench: number) =>
      `Manchester Red · ${starters} 首发 + ${bench} 替补`,
  },

  // Data page
  data: {
    title: "数据源",
    fieldLineup: "首发名单",
    fieldStats: "球员统计",
    fieldFixtures: "赛程信息",
    fieldEvents: "比赛事件",
    fieldStandings: "联赛排名",
    fieldScorers: "射手榜",
  },

  // Common
  common: {
    loading: "加载中...",
    error: "错误",
    ready: "就绪",
    complete: "完成",
    vs: "vs",
  },
} as const;

const en = {
  nav: {
    dashboard: "Dashboard",
    match: "Match Center",
    lineup: "Lineup Tactics",
    prediction: "Prediction",
    script: "AI Script",
    overlay: "OBS Overlay",
    stats: "Match Stats",
    compare: "Compare",
    data: "Data Sources",
    apiSettings: "API Settings",
    workspace: "Workspace",
    predictions: "Prediction History",
    login: "Login / Switch Account",
  },

  dashboard: {
    title: "Dashboard",
    loading: "Loading dashboard...",
    lineupIntegrity: "Lineup Integrity",
    scriptReady: "Script Ready",
    predictionConfidence: "Prediction Confidence",
    obsStatus: "OBS Status",
    trend: "Trend",
    lineupPreview: "Lineup Preview",
    aiSummary: "AI Pre-match Summary",
    predictionSummary: "Prediction Summary",
    last5Trend: "Last 5 Matches Trend",
    expectedGoals: "Expected Goals",
    keyPlayers: "Key Players",
    possibleScorers: "Possible Scorers",
    yellowCardRisks: "Yellow Card Risks",
    aiSummaryText: (home: string, winPct: number, confPct: number) =>
      `${home} are in excellent form with 3 consecutive wins. The Dixon-Coles model predicts a ${winPct}% home win probability, with lineup adjustments boosting confidence to ${confPct}%.`,
  },

  lineup: {
    title: "Lineup Tactics",
    formation: "Formation",
    tacticalInsights: "Tactical Insights",
    starters: "Starting XI",
    bench: "Bench Players",
    injuries: "Injury List",
    loading: "Loading lineup...",
    playerStats: "Player Statistics",
    playerStatsSubtitle: (starters: number, bench: number) =>
      `Manchester Red · ${starters} starters + ${bench} bench`,
  },

  data: {
    title: "Data Sources",
    fieldLineup: "Starting Lineup",
    fieldStats: "Player Statistics",
    fieldFixtures: "Fixture Info",
    fieldEvents: "Match Events",
    fieldStandings: "League Standings",
    fieldScorers: "Top Scorers",
  },

  common: {
    loading: "Loading...",
    error: "Error",
    ready: "Ready",
    complete: "Complete",
    vs: "vs",
  },
} as const;

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends (...args: infer A) => infer R ? (...args: A) => R : DeepStringify<T[K]>;
};

export type Translations = DeepStringify<typeof zh>;

const dictionaries: Record<Lang, Translations> = { zh, en } as Record<Lang, Translations>;

// ── Context ──────────────────────────────────────────────────────────

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "zh" || stored === "en") {
        setLangState(stored);
      }
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // localStorage may be unavailable
    }
    // Update the html lang attribute
    document.documentElement.lang = newLang === "zh" ? "zh-CN" : "en";
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: dictionaries[lang],
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within an I18nProvider");
  }
  return ctx;
}

// ── Helper for simple zh/en inline translation ───────────────────────

/**
 * For places where you already have a zh string and an en string and just
 * want to pick the right one based on the current language.
 */
export function useInlineT() {
  const { lang } = useTranslation();
  return useCallback(
    (zhText: string, enText: string) => (lang === "zh" ? zhText : enText),
    [lang],
  );
}
