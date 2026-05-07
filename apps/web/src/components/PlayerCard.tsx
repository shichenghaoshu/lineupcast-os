"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Star, Target, Crosshair, AlertTriangle } from "lucide-react";
import type { Player } from "@/lib/types";

interface PlayerCardProps {
  player: Player;
  compact?: boolean;
}

export function PlayerCard({ player, compact = false }: PlayerCardProps) {
  if (compact) {
    return (
      <Link href={`/players/${player.id}`}>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="card-hover flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-blue)]/20 text-sm font-bold text-[var(--accent-blue)]">
            {player.number}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{player.name}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {player.position} · {player.nationality}
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm">
            <Star className="h-3.5 w-3.5 text-[var(--accent-amber)]" />
            <span className="tabular-nums">{player.recentRating.toFixed(1)}</span>
          </div>
        </motion.div>
      </Link>
    );
  }

  return (
    <Link href={`/players/${player.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="card-hover space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-blue)]/20 text-lg font-bold text-[var(--accent-blue)]">
              {player.number}
            </div>
            <div>
              <div className="font-semibold">{player.name}</div>
              <div className="text-xs text-[var(--text-muted)]">
                {player.position} · {player.role} · {player.age}岁 · {player.nationality}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 text-[var(--accent-amber)]" />
            <span className="text-lg font-bold tabular-nums">
              {player.recentRating.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-xs text-[var(--text-muted)]">xG/5场</div>
            <div className="text-sm font-semibold tabular-nums">{player.xGLast5.toFixed(1)}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)]">射门/5场</div>
            <div className="text-sm font-semibold tabular-nums">{player.shotsLast5}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)]">助攻/5场</div>
            <div className="text-sm font-semibold tabular-nums">{player.assistsLast5}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)]">犯规/90</div>
            <div className="text-sm font-semibold tabular-nums">{player.foulsPer90.toFixed(1)}</div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-[var(--accent-green)]">
            <Target className="h-3 w-3" />
            进攻 VAEP {player.vaepAttack.toFixed(2)}
          </span>
          <span className="flex items-center gap-1 text-[var(--accent-blue)]">
            <Crosshair className="h-3 w-3" />
            防守 VAEP {player.vaepDefense.toFixed(2)}
          </span>
          {player.yellowCardsLast10 > 2 && (
            <span className="flex items-center gap-1 text-[var(--accent-amber)]">
              <AlertTriangle className="h-3 w-3" />
              黄牌 {player.yellowCardsLast10}
            </span>
          )}
        </div>

        <div className="rounded bg-[var(--bg-primary)] p-2 text-xs text-[var(--text-secondary)]">
          {player.commentaryNote}
        </div>
      </motion.div>
    </Link>
  );
}
