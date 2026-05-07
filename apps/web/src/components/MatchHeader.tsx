"use client";

import { memo } from "react";
import { Clock, MapPin, Radio } from "lucide-react";
import type { Match } from "@/lib/types";

interface MatchHeaderProps {
  match: Match;
}

export const MatchHeader = memo(function MatchHeader({ match }: MatchHeaderProps) {
  return (
    <div className="card">
      {/* Team matchup row */}
      <div className="flex items-center justify-center gap-4 sm:gap-6">
        <div className="text-center min-w-0">
          <div className="text-lg sm:text-2xl font-bold truncate max-w-[120px] sm:max-w-none">{match.homeTeam}</div>
          <div className="text-xs text-[var(--text-muted)]">主场</div>
        </div>
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="text-xs text-[var(--text-muted)]">VS</div>
          {match.status === "live" && match.homeScore !== undefined && (
            <div className="text-xl font-bold tabular-nums">
              {match.homeScore} - {match.awayScore}
            </div>
          )}
        </div>
        <div className="text-center min-w-0">
          <div className="text-lg sm:text-2xl font-bold truncate max-w-[120px] sm:max-w-none">{match.awayTeam}</div>
          <div className="text-xs text-[var(--text-muted)]">客场</div>
        </div>
      </div>

      {/* Info row -- wraps on mobile */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          T-75 min
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{match.venue}</span>
        </span>
        <span className="badge-green flex items-center gap-1.5">
          <Radio className="h-3 w-3 flex-shrink-0" />
          阵容已确认
        </span>
      </div>
    </div>
  );
});
