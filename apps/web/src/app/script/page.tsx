"use client";

import { useEffect, useState } from "react";
import { Globe, Radio, Settings, Timer, Wand2 } from "lucide-react";
import { ScriptTeleprompter } from "@/components/ScriptTeleprompter";
import { TopBar } from "@/components/TopBar";
import {
  generateScript,
  getDemoMatch,
  type Language,
  type ScriptDuration,
  type ScriptResult,
  type ScriptStyle,
} from "@/lib/api-client";

const languages: { key: Language; label: string }[] = [
  { key: "zh", label: "中文" },
  { key: "en", label: "English" },
  { key: "bilingual", label: "双语" },
];

const styles: { key: ScriptStyle; label: string }[] = [
  { key: "professional", label: "专业" },
  { key: "short-video", label: "短视频" },
  { key: "passionate", label: "激情" },
  { key: "neutral", label: "中性" },
  { key: "broadcast", label: "转播" },
];

const durations: { key: ScriptDuration; label: string }[] = [
  { key: "15s", label: "15秒" },
  { key: "30s", label: "30秒" },
  { key: "1min", label: "1分钟" },
  { key: "3min", label: "3分钟" },
];

export default function ScriptPage() {
  const [matchId, setMatchId] = useState("demo-manchester-red-vs-shanghai-harbor");
  const [language, setLanguage] = useState<Language>("zh");
  const [style, setStyle] = useState<ScriptStyle>("professional");
  const [duration, setDuration] = useState<ScriptDuration>("30s");
  const [result, setResult] = useState<ScriptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDemoMatch()
      .then((match) => setMatchId(match.matchId))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const generated = await generateScript(matchId, { language, style, duration });
      setResult(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setResult(localFallback(matchId, language, style, duration));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <TopBar title="AI 口播稿工作室" subtitle="API 生成 · 可控语言 / 风格 / 时长" />

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-3">
          <div className="card space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Settings className="h-4 w-4 text-[var(--accent-blue)]" />
              生成参数
            </div>

            <Segmented label="语言" items={languages} value={language} onChange={setLanguage} />
            <Segmented label="风格" items={styles} value={style} onChange={setStyle} />
            <Segmented label="时长" items={durations} value={duration} onChange={setDuration} />

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent-blue)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-blue)]/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Wand2 className="h-4 w-4" />
              {loading ? "生成中..." : "重新生成"}
            </button>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Globe className="h-4 w-4 text-[var(--accent-green)]" />
              生成状态
            </div>
            <StatusRow label="Provider" value={result?.provider ?? "LineupCast API"} />
            <StatusRow label="Model" value={result?.model ?? "pending"} />
            <StatusRow label="Latency" value={result ? `${result.latencyMs}ms` : "-"} />
            <StatusRow
              label="Fallback"
              value={result?.fallback ? "yes" : "no"}
              tone={result?.fallback ? "warning" : "success"}
            />
            {error && (
              <div className="rounded bg-red-500/10 p-2 text-xs text-[var(--accent-red)]">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 xl:col-span-9">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetaCard
              icon={<Radio className="h-4 w-4 text-[var(--accent-blue)]" />}
              label="Style"
              value={style}
            />
            <MetaCard
              icon={<Timer className="h-4 w-4 text-[var(--accent-amber)]" />}
              label="Duration"
              value={duration}
            />
            <MetaCard
              icon={<Globe className="h-4 w-4 text-[var(--accent-green)]" />}
              label="Language"
              value={language}
            />
          </div>

          <ScriptTeleprompter
            title={`${durations.find((item) => item.key === duration)?.label ?? duration} · ${styles.find((item) => item.key === style)?.label ?? style}`}
            text={result?.script ?? ""}
          />

          {result?.disclaimer && (
            <div className="card text-xs leading-relaxed text-[var(--text-muted)]">
              {result.disclaimer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-[var(--text-muted)]">{label}</label>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              value === item.key
                ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                : "bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span
        className={`min-w-0 truncate font-mono ${tone === "warning" ? "text-[var(--accent-amber)]" : tone === "success" ? "text-[var(--accent-green)]" : "text-[var(--text-secondary)]"}`}
      >
        {value}
      </span>
    </div>
  );
}

function MetaCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card flex items-center gap-3">
      {icon}
      <div className="min-w-0">
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}

function localFallback(
  matchId: string,
  language: Language,
  style: ScriptStyle,
  duration: ScriptDuration,
): ScriptResult {
  const script =
    language === "en"
      ? `Pre-match briefing for ${matchId}. Home win 48%, draw 27%, away win 25%. V. Finish is the top scorer candidate at 34%, while C. Press carries the highest yellow-card risk at 42%.`
      : language === "bilingual"
        ? `赛前简报 / Pre-match briefing\n主胜48%，平局27%，客胜25%。\nHome win 48%, draw 27%, away win 25%.\nV. Finish进球概率34%；C. Press黄牌风险42%。`
        : `赛前数据简报：主胜48%，平局27%，客胜25%。V. Finish 是头号进球候选，概率34%；C. Press 黄牌风险42%，需要控制拼抢尺度。`;

  return {
    matchId,
    script,
    disclaimer: "Local fallback shown because the API generation request failed.",
    provider: "Local fallback",
    model: `${style}-${duration}`,
    latencyMs: 0,
    fallback: true,
  };
}
