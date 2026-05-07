"use client";

import { useState, useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { FormationPitch } from "@/components/FormationPitch";
import { PlayerCard } from "@/components/PlayerCard";
import { DemoBadge } from "@/components/DemoBadge";
import { Dropdown } from "@/components/Dropdown";
import { useTranslation } from "@/lib/i18n";
import { loadLineups } from "@/lib/data-loader";
import type { Player } from "@/lib/types";
import { Loader2, ChevronDown } from "lucide-react";

type Formation = "4-2-3-1" | "4-3-3";

export default function LineupPage() {
  const { t } = useTranslation();
  const [formation, setFormation] = useState<Formation>("4-2-3-1");
  const [starters, setStarters] = useState<Player[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchLineup() {
      const result = await loadLineups("match-001");
      if (cancelled) return;
      setStarters(result.data);
      setIsDemo(result.isDemo);
      setLoading(false);
    }

    fetchLineup();
    return () => {
      cancelled = true;
    };
  }, []);

  const bench: Player[] = [
    { id: "bench-1", number: 12, name: "S. Late", position: "CM", role: "Central Midfielder", age: 24, nationality: "ENG", recentRating: 6.5, xGLast5: 0.2, shotsLast5: 3, assistsLast5: 1, foulsPer90: 1.8, yellowCardsLast10: 2, redCardsLast10: 0, vaepAttack: 0.25, vaepDefense: 0.45, commentaryNote: "替补中场，体能充沛。", x: 50, y: 50 },
    { id: "bench-2", number: 13, name: "H. Counter", position: "CF", role: "Centre Forward", age: 25, nationality: "COL", recentRating: 6.7, xGLast5: 0.8, shotsLast5: 7, assistsLast5: 0, foulsPer90: 1.1, yellowCardsLast10: 1, redCardsLast10: 0, vaepAttack: 0.55, vaepDefense: 0.1, commentaryNote: "速度快，反击利器。", x: 50, y: 20 },
    { id: "bench-3", number: 14, name: "D. Anchor", position: "CB", role: "Centre Back", age: 31, nationality: "ITA", recentRating: 6.8, xGLast5: 0.1, shotsLast5: 1, assistsLast5: 0, foulsPer90: 1.5, yellowCardsLast10: 3, redCardsLast10: 0, vaepAttack: 0.08, vaepDefense: 0.75, commentaryNote: "经验丰富的中后卫替补。", x: 50, y: 80 },
  ];

  const injuries: Player[] = [
    { id: "inj-1", number: 15, name: "R. Flex", position: "CM", role: "Central Midfielder", age: 23, nationality: "SWE", recentRating: 6.2, xGLast5: 0.3, shotsLast5: 4, assistsLast5: 2, foulsPer90: 0.9, yellowCardsLast10: 1, redCardsLast10: 0, vaepAttack: 0.3, vaepDefense: 0.4, commentaryNote: "膝伤恢复中，预计2周后复出。", x: 50, y: 50 },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-blue)]" />
        <span className="ml-2 text-sm text-[var(--text-muted)]">
          {t.lineup.loading}
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between">
        <TopBar
          title={t.lineup.title}
          subtitle={`Manchester Red ${formation} vs Shanghai Harbor 4-3-3`}
        />
        {isDemo && (
          <div className="fixed right-4 top-3 z-50">
            <DemoBadge />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 md:p-6">
        {/* Formation selector */}
        <div className="lg:col-span-12 flex items-center gap-3">
          <span className="text-xs text-[var(--text-muted)]">{t.lineup.formation}:</span>
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-card-hover)]">
                {formation}
                <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>
            }
            items={[
              {
                id: "f-4231",
                label: "4-2-3-1",
                onClick: () => setFormation("4-2-3-1"),
              },
              {
                id: "f-433",
                label: "4-3-3",
                onClick: () => setFormation("4-3-3"),
              },
            ]}
            width="w-40"
          />
        </div>

        {/* Tactical pitch */}
        <div className="lg:col-span-7">
          <div className="card">
            <FormationPitch players={starters} formation={formation} />
          </div>
        </div>

        {/* Side lists */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              {t.lineup.tacticalInsights}
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              B. Vision 将在前腰区域连接两翼，C. Press 负责高位压迫。
              Shanghai Harbor 的 4-3-3 更依赖 H. Counter 的转换速度。
            </p>
          </div>

          {/* Starters */}
          <div className="card">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              {t.lineup.starters} ({starters.length})
            </div>
            <div className="space-y-1.5">
              {starters.map((p) => (
                <PlayerCard key={p.id} player={p} compact />
              ))}
            </div>
          </div>

          {/* Bench */}
          <div className="card">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              替补球员 ({bench.length})
            </div>
            <div className="space-y-1.5">
              {bench.map((p) => (
                <PlayerCard key={p.id} player={p} compact />
              ))}
            </div>
          </div>

          {/* Injuries */}
          <div className="card">
            <div className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--accent-red)]">
              伤病名单 ({injuries.length})
            </div>
            <div className="space-y-1.5">
              {injuries.map((p) => (
                <PlayerCard key={p.id} player={p} compact />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
