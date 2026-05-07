/**
 * Theme customization system for LineupCast OS.
 *
 * Provides three built-in presets (dark, light, high-contrast) and allows
 * users to override individual accent colors. The active theme is persisted
 * in localStorage and applied via a `data-theme` attribute on <html>.
 */

export type ThemeId = "dark" | "light" | "high-contrast" | "custom";

export interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgCard: string;
  bgCardHover: string;
  borderColor: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentBlue: string;
  accentGreen: string;
  accentPurple: string;
  accentAmber: string;
  accentRed: string;
}

export interface ThemePreset {
  id: ThemeId;
  label: string;
  /** Short description shown in the picker UI */
  description: string;
  colors: ThemeColors;
}

// ---------------------------------------------------------------------------
// Preset definitions
// ---------------------------------------------------------------------------

export const darkPreset: ThemePreset = {
  id: "dark",
  label: "深色",
  description: "默认深色主题",
  colors: {
    bgPrimary: "#0a0e17",
    bgSecondary: "#111827",
    bgCard: "#1a2236",
    bgCardHover: "#1f2a42",
    borderColor: "#2a3550",
    textPrimary: "#e5e7eb",
    textSecondary: "#9ca3af",
    textMuted: "#6b7280",
    accentBlue: "#3b82f6",
    accentGreen: "#10b981",
    accentPurple: "#8b5cf6",
    accentAmber: "#f59e0b",
    accentRed: "#ef4444",
  },
};

export const lightPreset: ThemePreset = {
  id: "light",
  label: "浅色",
  description: "明亮背景主题",
  colors: {
    bgPrimary: "#f8fafc",
    bgSecondary: "#ffffff",
    bgCard: "#f1f5f9",
    bgCardHover: "#e2e8f0",
    borderColor: "#cbd5e1",
    textPrimary: "#1e293b",
    textSecondary: "#475569",
    textMuted: "#94a3b8",
    accentBlue: "#2563eb",
    accentGreen: "#059669",
    accentPurple: "#7c3aed",
    accentAmber: "#d97706",
    accentRed: "#dc2626",
  },
};

export const highContrastPreset: ThemePreset = {
  id: "high-contrast",
  label: "高对比",
  description: "高对比度无障碍主题",
  colors: {
    bgPrimary: "#000000",
    bgSecondary: "#0a0a0a",
    bgCard: "#1a1a1a",
    bgCardHover: "#262626",
    borderColor: "#525252",
    textPrimary: "#ffffff",
    textSecondary: "#d4d4d4",
    textMuted: "#a3a3a3",
    accentBlue: "#60a5fa",
    accentGreen: "#34d399",
    accentPurple: "#a78bfa",
    accentAmber: "#fbbf24",
    accentRed: "#f87171",
  },
};

export const PRESETS: ThemePreset[] = [darkPreset, lightPreset, highContrastPreset];

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY_THEME = "lineupcast-theme";
const STORAGE_KEY_CUSTOM_COLORS = "lineupcast-custom-colors";

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadThemeId(): ThemeId {
  const ls = safeLocalStorage();
  if (!ls) return "dark";
  const raw = ls.getItem(STORAGE_KEY_THEME);
  if (raw === "light" || raw === "high-contrast" || raw === "custom") return raw;
  return "dark";
}

export function saveThemeId(id: ThemeId): void {
  safeLocalStorage()?.setItem(STORAGE_KEY_THEME, id);
}

export function loadCustomColors(): Partial<ThemeColors> {
  const ls = safeLocalStorage();
  if (!ls) return {};
  try {
    const raw = ls.getItem(STORAGE_KEY_CUSTOM_COLORS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomColors(colors: Partial<ThemeColors>): void {
  safeLocalStorage()?.setItem(STORAGE_KEY_CUSTOM_COLORS, JSON.stringify(colors));
}

// ---------------------------------------------------------------------------
// Apply theme to DOM
// ---------------------------------------------------------------------------

const CSS_VAR_MAP: Record<keyof ThemeColors, string> = {
  bgPrimary: "--bg-primary",
  bgSecondary: "--bg-secondary",
  bgCard: "--bg-card",
  bgCardHover: "--bg-card-hover",
  borderColor: "--border-color",
  textPrimary: "--text-primary",
  textSecondary: "--text-secondary",
  textMuted: "--text-muted",
  accentBlue: "--accent-blue",
  accentGreen: "--accent-green",
  accentPurple: "--accent-purple",
  accentAmber: "--accent-amber",
  accentRed: "--accent-red",
};

/**
 * Resolve the full color set for a given theme id, merging custom overrides
 * when the id is "custom".
 */
export function resolveColors(id: ThemeId, customOverrides: Partial<ThemeColors> = {}): ThemeColors {
  let base: ThemeColors;
  if (id === "custom") {
    // Start from dark as the base, then merge custom overrides
    base = { ...darkPreset.colors, ...customOverrides };
  } else {
    const preset = PRESETS.find((p) => p.id === id) ?? darkPreset;
    base = preset.colors;
  }
  return base;
}

/**
 * Apply theme colors as CSS custom properties on `document.documentElement`.
 * Safe to call during SSR (no-op when `document` is unavailable).
 */
export function applyThemeToDOM(id: ThemeId, customOverrides: Partial<ThemeColors> = {}): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const colors = resolveColors(id, customOverrides);

  root.setAttribute("data-theme", id);

  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    const value = colors[key as keyof ThemeColors];
    root.style.setProperty(cssVar, value);
  }
}
