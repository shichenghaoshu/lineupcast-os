"use client";

import { TopBar } from "@/components/TopBar";
import { OverlayPreview } from "@/components/OverlayPreview";
import { manchesterRedXI } from "@/lib/mock-data";
import { Monitor, Copy, ExternalLink } from "lucide-react";

export default function OverlayPage() {
  const topScorer = manchesterRedXI.find((p) => p.id === "finish-st")!;

  return (
    <div className="min-h-screen">
      <TopBar title="OBS Output / 直播输出" subtitle="实时图形输出配置" />

      <div className="grid grid-cols-12 gap-4 p-6">
        {/* Previews */}
        <div className="col-span-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* 16:9 Preview */}
            <OverlayPreview aspect="16:9" label="Broadcast Scene 16:9">
              <div className="flex h-full w-full flex-col justify-between p-4">
                {/* Top bar */}
                <div className="flex items-center justify-between rounded bg-black/60 px-4 py-2">
                  <span className="text-sm font-bold text-white">Manchester Red</span>
                  <span className="text-xs text-white/70">VS</span>
                  <span className="text-sm font-bold text-white">Shanghai Harbor</span>
                </div>
                {/* Prediction strip */}
                <div className="flex items-center gap-2 rounded bg-black/60 px-3 py-1.5">
                  <span className="text-[10px] text-white/60">胜率</span>
                  <div className="flex flex-1 gap-1">
                    <div className="h-1 flex-[48] rounded-full bg-emerald-500" />
                    <div className="h-1 flex-[27] rounded-full bg-amber-500" />
                    <div className="h-1 flex-[25] rounded-full bg-blue-500" />
                  </div>
                  <span className="text-[10px] text-emerald-400">48%</span>
                  <span className="text-[10px] text-amber-400">27%</span>
                  <span className="text-[10px] text-blue-400">25%</span>
                </div>
              </div>
            </OverlayPreview>

            {/* 9:16 Preview */}
            <OverlayPreview aspect="9:16" label="Short Video Scene 9:16">
              <div className="flex h-full w-full flex-col justify-between p-3">
                <div className="rounded bg-black/60 px-3 py-2 text-center">
                  <div className="text-xs font-bold text-white">Manchester Red</div>
                  <div className="text-[10px] text-white/60">VS</div>
                  <div className="text-xs font-bold text-white">Shanghai Harbor</div>
                </div>
                <div className="rounded bg-black/60 px-2 py-1.5 text-center">
                  <div className="text-[10px] text-emerald-400">主胜 48%</div>
                  <div className="text-[10px] text-amber-400">平局 27%</div>
                  <div className="text-[10px] text-blue-400">客胜 25%</div>
                </div>
              </div>
            </OverlayPreview>
          </div>

          {/* Lineup graphic preview */}
          <div className="card space-y-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Lineup Graphic / 阵容图形预览
            </div>
            <div className="flex items-center gap-6 rounded bg-[var(--bg-primary)] p-4">
              <div className="flex flex-col items-center gap-1">
                <div className="text-sm font-bold">Manchester Red</div>
                <div className="text-xs text-[var(--text-muted)]">4-2-3-1</div>
              </div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {manchesterRedXI.map((p) => (
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
                <div className="text-lg font-bold text-[var(--accent-green)]">34%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Config */}
        <div className="col-span-4 space-y-4">
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
              JSON Webhook
            </div>
            <div className="rounded bg-[var(--bg-primary)] p-2 font-mono text-[10px] text-[var(--text-secondary)] break-all">
              http://localhost:3000/api/overlay/webhook
            </div>
            <button className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border-color)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]">
              <Copy className="h-3 w-3" />
              复制 Webhook URL
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
