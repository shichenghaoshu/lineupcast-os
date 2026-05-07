"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Check, ChevronDown } from "lucide-react";
import {
  PRESETS,
  type ThemeId,
  type ThemeColors,
  loadThemeId,
  saveThemeId,
  loadCustomColors,
  saveCustomColors,
  applyThemeToDOM,
  resolveColors,
} from "@/lib/theme";

// ---------------------------------------------------------------------------
// Color picker row -- inline hex input + native color input
// ---------------------------------------------------------------------------

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-[var(--border-color)] bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="w-[5.5rem] rounded border border-[var(--border-color)] bg-[var(--bg-primary)] px-1.5 py-0.5 text-xs text-[var(--text-primary)] font-mono"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom color panel -- only visible when ThemeId === "custom"
// ---------------------------------------------------------------------------

function CustomColorPanel({
  customColors,
  onChange,
}: {
  customColors: Partial<ThemeColors>;
  onChange: (colors: Partial<ThemeColors>) => void;
}) {
  const defaults = resolveColors("dark");
  const merged = { ...defaults, ...customColors };

  const set = (key: keyof ThemeColors, val: string) => {
    const next = { ...customColors, [key]: val };
    onChange(next);
  };

  const entries: [keyof ThemeColors, string][] = [
    ["bgPrimary", "背景主色"],
    ["bgSecondary", "背景次色"],
    ["bgCard", "卡片背景"],
    ["borderColor", "边框颜色"],
    ["textPrimary", "主文字色"],
    ["textSecondary", "次文字色"],
    ["accentBlue", "强调蓝"],
    ["accentGreen", "强调绿"],
    ["accentPurple", "强调紫"],
    ["accentAmber", "强调琥珀"],
    ["accentRed", "强调红"],
  ];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-2 overflow-hidden pt-2"
    >
      {entries.map(([key, label]) => (
        <ColorRow
          key={key}
          label={label}
          value={merged[key]}
          onChange={(v) => set(key, v)}
        />
      ))}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// ThemeSwitcher -- main exported component
// ---------------------------------------------------------------------------

export function ThemeSwitcher() {
  const [currentId, setCurrentId] = useState<ThemeId>("dark");
  const [customColors, setCustomColors] = useState<Partial<ThemeColors>>({});
  const [expanded, setExpanded] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setCurrentId(loadThemeId());
    setCustomColors(loadCustomColors());
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    applyThemeToDOM(currentId, customColors);
  }, [currentId, customColors]);

  const selectPreset = useCallback(
    (id: ThemeId) => {
      setCurrentId(id);
      saveThemeId(id);
      if (id !== "custom") {
        // Clear custom overrides when switching back to a preset
        setCustomColors({});
        saveCustomColors({});
      }
      applyThemeToDOM(id, id === "custom" ? customColors : {});
    },
    [customColors],
  );

  const handleCustomChange = useCallback(
    (colors: Partial<ThemeColors>) => {
      setCustomColors(colors);
      saveCustomColors(colors);
      setCurrentId("custom");
      saveThemeId("custom");
      applyThemeToDOM("custom", colors);
    },
    [],
  );

  return (
    <div className="space-y-1">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <Palette className="h-3.5 w-3.5" />
          主题设置
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 overflow-hidden px-2 pb-2"
          >
            {/* Preset buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {PRESETS.map((preset) => {
                const isActive = currentId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => selectPreset(preset.id)}
                    className={`relative flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[10px] transition-colors ${
                      isActive
                        ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                        : "border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
                    }`}
                    title={preset.description}
                  >
                    {/* Color swatch preview */}
                    <div className="flex gap-0.5">
                      <span
                        className="h-3 w-3 rounded-sm border border-[var(--border-color)]"
                        style={{ backgroundColor: preset.colors.bgPrimary }}
                      />
                      <span
                        className="h-3 w-3 rounded-sm border border-[var(--border-color)]"
                        style={{ backgroundColor: preset.colors.accentBlue }}
                      />
                      <span
                        className="h-3 w-3 rounded-sm border border-[var(--border-color)]"
                        style={{ backgroundColor: preset.colors.accentGreen }}
                      />
                    </div>
                    <span className="font-medium">{preset.label}</span>
                    {isActive && (
                      <Check className="absolute right-1 top-1 h-3 w-3" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom theme trigger */}
            <button
              onClick={() => {
                if (currentId !== "custom") {
                  selectPreset("custom");
                } else {
                  setExpanded((v) => !v);
                }
              }}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-1.5 text-xs transition-colors ${
                currentId === "custom"
                  ? "border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]"
                  : "border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
              }`}
            >
              <span>自定义颜色</span>
              {currentId === "custom" && <Check className="h-3 w-3" />}
            </button>

            {/* Custom color picker panel */}
            <AnimatePresence>
              {currentId === "custom" && (
                <CustomColorPanel
                  customColors={customColors}
                  onChange={handleCustomChange}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
