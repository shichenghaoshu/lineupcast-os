"use client";

import { useTranslation, type Lang } from "@/lib/i18n";

const options: { key: Lang; label: string }[] = [
  { key: "zh", label: "中文" },
  { key: "en", label: "EN" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();

  return (
    <div className="flex rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] p-1">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => setLang(opt.key)}
          className={`rounded px-2.5 py-1 text-xs transition-colors ${
            lang === opt.key
              ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
