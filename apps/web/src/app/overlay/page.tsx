"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { OverlayPreview } from "@/components/OverlayPreview";
import { DemoBadge } from "@/components/DemoBadge";
import { loadMatch, loadLineups, loadPrediction } from "@/lib/data-loader";
import type { Match, Player, Prediction } from "@/lib/types";
import {
  Monitor,
  Copy,
  ExternalLink,
  Download,
  Image,
  Check,
  Loader2,
} from "lucide-react";

export default function OverlayPage() {
  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const [m, l, p] = await Promise.all([
        loadMatch(),
        loadLineups("match-001"),
        loadPrediction("match-001"),
      ]);
      if (cancelled) return;

      setMatch(m.data);
      setPlayers(l.data);
      setPrediction(p.data);
      setIsDemo(m.isDemo || l.isDemo || p.isDemo);
      setLoading(false);
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !match || !prediction) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-blue)]" />
        <span className="ml-2 text-sm text-[var(--text-muted)]">
          Loading overlay...
        </span>
      </div>
    );
  }

  const topScorer = players.find((p) => p.id === "finish-st") ?? players[0];
  const obsUrl = `/api/overlay/${match.id}?scene=lineup`;

  function handleCopyUrl() {
    navigator.clipboard.writeText(window.location.origin + obsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between">
        <TopBar title="OBS Output / 直播输出" subtitle="实时图形输出配置" />
        {isDemo && (
          <div className="fixed right-4 top-3 z-50">
            <DemoBadge />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 md:p-6">
        {/* Previews */}
        <div className="xl:col-span-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 16:9 Preview */}
            <OverlayPreview aspect="16:9" label="Broadcast Scene 16:9">
              <div className="flex h-full w-full flex-col justify-between p-4">
                <div className="flex items-center justify-between rounded bg-black/60 px-4 py-2">
                  <span className="text-sm font-bold text-white">
                    {match.homeTeam}
                  </span>
                  <span className="text-xs text-white/70">VS</span>
                  <span className="text-sm font-bold text-white">
                    {match.awayTeam}
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded bg-black/60 px-3 py-1.5">
                  <span className="text-[10px] text-white/60">胜率</span>
                  <div className="flex flex-1 gap-1">
                    <div
                      className="h-1 rounded-full bg-emerald-500"
                      style={{ flex: prediction.homeWin }}
                    />
                    <div
                      className="h-1 rounded-full bg-amber-500"
                      style={{ flex: prediction.draw }}
                    />
                    <div
                      className="h-1 rounded-full bg-blue-500"
                      style={{ flex: prediction.awayWin }}
                    />
                  </div>
                  <span className="text-[10px] text-emerald-400">
                    {prediction.homeWin}%
                  </span>
                  <span className="text-[10px] text-amber-400">
                    {prediction.draw}%
                  </span>
                  <span className="text-[10px] text-blue-400">
                    {prediction.awayWin}%
                  </span>
                </div>
              </div>
            </OverlayPreview>

            {/* 9:16 Preview */}
            <OverlayPreview aspect="9:16" label="Short Video Scene 9:16">
              <div className="flex h-full w-full flex-col justify-between p-3">
                <div className="rounded bg-black/60 px-3 py-2 text-center">
                  <div className="text-xs font-bold text-white">
                    {match.homeTeam}
                  </div>
                  <div className="text-[10px] text-white/60">VS</div>
                  <div className="text-xs font-bold text-white">
                    {match.awayTeam}
                  </div>
                </div>
                <div className="rounded bg-black/60 px-2 py-1.5 text-center">
                  <div className="text-[10px] text-emerald-400">
                    主胜 {prediction.homeWin}%
                  </div>
                  <div className="text-[10px] text-amber-400">
                    平局 {prediction.draw}%
                  </div>
                  <div className="text-[10px] text-blue-400">
                    客胜 {prediction.awayWin}%
                  </div>
                </div>
              </div>
            </OverlayPreview>
          </div>

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-2">
            <button className="flex items-center gap-2 rounded-md bg-[var(--accent-green)]/15 px-3 py-2 text-xs font-medium text-[var(--accent-green)] transition-colors hover:bg-[var(--accent-green)]/25">
              <Download className="h-3.5 w-3.5" />
              Export PNG (16:9)
            </button>
            <button className="flex items-center gap-2 rounded-md bg-[var(--accent-blue)]/15 px-3 py-2 text-xs font-medium text-[var(--accent-blue)] transition-colors hover:bg-[var(--accent-blue)]/25">
              <Image className="h-3.5 w-3.5" />
              Export SVG
            </button>
            <button className="flex items-center gap-2 rounded-md bg-[var(--accent-purple)]/15 px-3 py-2 text-xs font-medium text-[var(--accent-purple)] transition-colors hover:bg-[var(--accent-purple)]/25">
              <Download className="h-3.5 w-3.5" />
              Export All Scenes
            </button>
          </div>

          {/* Lineup graphic preview */}
          <div className="card space-y-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Lineup Graphic / 阵容图形预览
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 rounded bg-[var(--bg-primary)] p-4">
              <div className="flex flex-col items-center gap-1">
                <div className="text-sm font-bold">{match.homeTeam}</div>
                <div className="text-xs text-[var(--text-muted)]">4-2-3-1</div>
              </div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1 rounded bg-[var(--bg-card)] px-2 py-1"
                  >
                    <span className="text-[10px] font-bold text-[var(--accent-blue)]">
                      {p.number}
                    </span>
                    <span className="text-[10px]">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Lower-third player bar */}
          <div className="card space-y-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Lower-third Player / 下方球员信息条
            </div>
            <div className="flex items-center gap-4 rounded bg-gradient-to-r from-[var(--accent-blue)]/20 to-transparent p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-blue)] text-lg font-bold">
                {topScorer.number}
              </div>
              <div>
                <div className="text-sm font-bold">{topScorer.name}</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {topScorer.position} · 评分 {topScorer.recentRating} · xG{" "}
                  {topScorer.xGLast5}
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-[var(--text-muted)]">进球概率</div>
                <div className="text-lg font-bold text-[var(--accent-green)]">
                  {prediction.possibleScorers[0]?.probability ?? 0}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Config */}
        <div className="xl:col-span-4 space-y-4">
          <div className="card space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Monitor className="h-4 w-4 text-[var(--accent-blue)]" />
              输出配置
            </div>
            <div className="space-y-2">
              {[
                { label: "分辨率", value: "1920x1080" },
                { label: "帧率", value: "30fps" },
                { label: "编码", value: "H.264" },
                { label: "比特率", value: "4000 kbps" },
              ].map((cfg) => (
                <div
                  key={cfg.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-[var(--text-muted)]">{cfg.label}</span>
                  <span className="tabular-nums">{cfg.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ExternalLink className="h-4 w-4 text-[var(--accent-green)]" />
              OBS Browser Source
            </div>
            <div className="rounded bg-[var(--bg-primary)] p-2 font-mono text-[10px] text-[var(--text-secondary)] break-all">
              {obsUrl}
            </div>
            <button
              onClick={handleCopyUrl}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
            >
              {copied ? (
                <Check className="h-3 w-3 text-[var(--accent-green)]" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              {copied ? "已复制!" : "复制 Browser Source URL"}
            </button>
          </div>

          <div className="card space-y-2">
            <div className="text-xs font-medium text-[var(--text-muted)]">
              图层开关
            </div>
            {["比分牌", "阵容图", "胜率条", "球员信息条", "角标水印"].map(
              (layer) => (
                <label
                  key={layer}
                  className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                >
                  <input
                    type="checkbox"
                    defaultChecked
                    className="rounded border-[var(--border-color)] bg-[var(--bg-primary)]"
                  />
                  {layer}
                </label>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
