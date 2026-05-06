"use client";

import { Clock, MapPin, Radio } from "lucide-react";
import type { Match } from "@/lib/types";

interface MatchHeaderProps {
  match: Match;
}

export function MatchHeader({ match }: MatchHeaderProps) {
  return (
    <div className="card flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold">{match.homeTeam}</div>
          <div className="text-xs text-[var(--text-muted)]">主场</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-xs text-[var(--text-muted)]">VS</div>
          {match.status === "live" && match.homeScore !== undefined && (
            <div className="text-xl font-bold tabular-nums">
              {match.homeScore} - {match.awayScore}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold">{match.awayTeam}</div>
          <div className="text-xs text-[var(--text-muted)]">客场</div>
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          T-75 min
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" />
          {match.venue}
        </span>
        <span className="badge-green flex items-center gap-1.5">
          <Radio className="h-3 w-3" />
          阵容已确认
        </span>
      </div>
    </div>
  );
}
