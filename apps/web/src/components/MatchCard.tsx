"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, MapPin, ChevronRight, Radio } from "lucide-react";
import {
  livePulse,
  cardHover,
  staggerContainerFast,
  staggerChild,
} from "@/lib/animations";
import type { Match } from "@/lib/types";
import type { ApiMatch } from "@/lib/api-client";

/* ------------------------------------------------------------------ */
/*  Team Crest (letter-initial placeholder)                           */
/* ------------------------------------------------------------------ */

function TeamCrest({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-lg",
  };

  // Deterministic color from name
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold tracking-wide ${sizeClasses[size]}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 60%, 35%), hsl(${(hue + 40) % 360}, 50%, 25%))`,
        color: `hsl(${hue}, 70%, 85%)`,
      }}
    >
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                      */
/* ------------------------------------------------------------------ */

function StatusBadge({
  status,
  minute,
}: {
  status: Match["status"] | string;
  minute?: number;
}) {
  if (status === "live") {
    return (
      <span className="badge-red flex items-center gap-1 text-[10px]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        {minute !== undefined ? `${minute}'` : "LIVE"}
      </span>
    );
  }

  if (status === "finished") {
    return <span className="badge-amber text-[10px]">FT</span>;
  }

  return <span className="badge-blue text-[10px]">Upcoming</span>;
}

/* ------------------------------------------------------------------ */
/*  Kickoff formatter                                                 */
/* ------------------------------------------------------------------ */

function formatKickoff(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
    const time = d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return { date, time };
  } catch {
    return { date: "--", time: "--:--" };
  }
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface MatchCardProps {
  /** Accept either the local Match type or the API ApiMatch type */
  match: Match | ApiMatch;
  /** Optional prediction data for quick preview */
  prediction?: {
    homeWin: number;
    draw: number;
    awayWin: number;
    expectedHomeGoals?: number;
    expectedAwayGoals?: number;
    confidence?: number;
  } | null;
  /** Where to link on click. Defaults to /match */
  href?: string;
  /** Visual variant */
  variant?: "default" | "compact" | "selectable";
  /** Click handler (alternative to link navigation) */
  onClick?: () => void;
  /** Show venue info */
  showVenue?: boolean;
  /** Optional className for the outer wrapper */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Normalize match data                                              */
/* ------------------------------------------------------------------ */

function normalizeMatch(match: Match | ApiMatch) {
  if ("homeTeam" in match && typeof match.homeTeam === "object") {
    // ApiMatch
    const m = match as ApiMatch;
    return {
      id: m.matchId,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      kickoff: m.kickoff,
      venue: (m as unknown as Record<string, unknown>).venue as string | undefined,
      status: m.status,
      minute: (m as unknown as Record<string, unknown>).minute as number | undefined,
      homeScore: m.score?.home,
      awayScore: m.score?.away,
      competition: m.competition,
    };
  }
  // Local Match
  const m = match as Match;
  return {
    id: m.id,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    kickoff: m.kickoff,
    venue: m.venue,
    status: m.status,
    minute: m.minute,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    competition: undefined as string | undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function MatchCard({
  match,
  prediction,
  href,
  variant = "default",
  onClick,
  showVenue = true,
  className = "",
}: MatchCardProps) {
  const m = normalizeMatch(match);
  const { date, time } = formatKickoff(m.kickoff);
  const isLive = m.status === "live";
  const isFinished = m.status === "finished";
  const hasScore = m.homeScore !== undefined && m.awayScore !== undefined;
  const linkHref = href ?? `/match?id=${m.id}`;

  const isClickable = variant === "selectable" || onClick;

  const content = (
    <div
      className={`
        group relative overflow-hidden rounded-lg border bg-[var(--bg-card)] border-[var(--border-color)]
        transition-all duration-200
        ${isClickable ? "cursor-pointer hover:border-[var(--accent-blue)]/50 hover:bg-[var(--bg-card-hover)]" : "hover:bg-[var(--bg-card-hover)]"}
        ${className}
      `}
    >
      {/* Live pulse border */}
      {isLive && (
        <motion.div
          className="absolute inset-0 rounded-lg border-2 border-[var(--accent-red)]/40"
          variants={livePulse}
          animate="animate"
        />
      )}

      <div className="p-4">
        {/* Top row: competition + status + kickoff */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {m.competition && (
              <span className="text-[11px] text-[var(--text-muted)]">
                {m.competition}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={m.status} minute={m.minute} />
          </div>
        </div>

        {/* Main match area */}
        <div className="flex items-center justify-between gap-3">
          {/* Home team */}
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <TeamCrest name={m.homeTeam} size={variant === "compact" ? "sm" : "md"} />
            <span
              className={`text-center font-semibold leading-tight ${
                variant === "compact" ? "text-xs" : "text-sm"
              }`}
            >
              {m.homeTeam}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">HOME</span>
          </div>

          {/* Score / VS */}
          <div className="flex flex-col items-center gap-1">
            {hasScore ? (
              <div className="flex items-center gap-2">
                <span
                  className={`font-bold tabular-nums ${
                    variant === "compact" ? "text-xl" : "text-3xl"
                  }`}
                >
                  {m.homeScore}
                </span>
                <span className="text-lg text-[var(--text-muted)]">-</span>
                <span
                  className={`font-bold tabular-nums ${
                    variant === "compact" ? "text-xl" : "text-3xl"
                  }`}
                >
                  {m.awayScore}
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
                vs
              </span>
            )}
            {/* Kickoff time */}
            <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <Clock className="h-3 w-3" />
              <span>
                {date} {time}
              </span>
            </div>
          </div>

          {/* Away team */}
          <div className="flex flex-1 flex-col items-center gap-1.5">
            <TeamCrest name={m.awayTeam} size={variant === "compact" ? "sm" : "md"} />
            <span
              className={`text-center font-semibold leading-tight ${
                variant === "compact" ? "text-xs" : "text-sm"
              }`}
            >
              {m.awayTeam}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">AWAY</span>
          </div>
        </div>

        {/* Venue row */}
        {showVenue && m.venue && (
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <MapPin className="h-3 w-3" />
            {m.venue}
          </div>
        )}

        {/* Quick prediction preview */}
        {prediction && variant !== "compact" && (
          <div className="mt-3 rounded-md bg-[var(--bg-primary)] px-3 py-2">
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              AI Prediction
            </div>
            <div className="flex items-center justify-between text-center">
              <div className="flex-1">
                <div className="text-xs text-[var(--text-muted)]">Home</div>
                <div className="text-sm font-bold tabular-nums text-[var(--accent-green)]">
                  {prediction.homeWin}%
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-[var(--text-muted)]">Draw</div>
                <div className="text-sm font-bold tabular-nums text-[var(--accent-amber)]">
                  {prediction.draw}%
                </div>
              </div>
              <div className="flex-1">
                <div className="text-xs text-[var(--text-muted)]">Away</div>
                <div className="text-sm font-bold tabular-nums text-[var(--accent-blue)]">
                  {prediction.awayWin}%
                </div>
              </div>
              {prediction.confidence !== undefined && (
                <div className="flex-1 border-l border-[var(--border-color)] pl-3">
                  <div className="text-xs text-[var(--text-muted)]">Conf</div>
                  <div className="text-sm font-bold tabular-nums text-[var(--accent-purple)]">
                    {prediction.confidence}%
                  </div>
                </div>
              )}
            </div>
            {/* Probability bar */}
            <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
              <div
                className="bg-[var(--accent-green)]"
                style={{ width: `${prediction.homeWin}%` }}
              />
              <div
                className="bg-[var(--accent-amber)]"
                style={{ width: `${prediction.draw}%` }}
              />
              <div
                className="bg-[var(--accent-blue)]"
                style={{ width: `${prediction.awayWin}%` }}
              />
            </div>
            {/* xG preview */}
            {prediction.expectedHomeGoals !== undefined &&
              prediction.expectedAwayGoals !== undefined && (
                <div className="mt-2 flex items-center justify-center gap-4 text-[11px]">
                  <span className="text-[var(--text-muted)]">xG</span>
                  <span className="font-medium tabular-nums text-[var(--accent-green)]">
                    {prediction.expectedHomeGoals.toFixed(1)}
                  </span>
                  <span className="text-[var(--text-muted)]">-</span>
                  <span className="font-medium tabular-nums text-[var(--accent-blue)]">
                    {prediction.expectedAwayGoals.toFixed(1)}
                  </span>
                </div>
              )}
          </div>
        )}

        {/* Selectable arrow */}
        {variant === "selectable" && (
          <div className="mt-3 flex items-center justify-end">
            <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-blue)]" />
          </div>
        )}
      </div>
    </div>
  );

  // Wrap in link or click handler
  if (onClick) {
    return (
      <button onClick={onClick} className="w-full text-left">
        {content}
      </button>
    );
  }

  if (href || variant !== "selectable") {
    return <Link href={linkHref}>{content}</Link>;
  }

  return content;
}

/* ------------------------------------------------------------------ */
/*  List variant: renders multiple matches in a grid                   */
/* ------------------------------------------------------------------ */

export function MatchCardList({
  matches,
  predictions,
  variant = "default",
  onSelect,
}: {
  matches: (Match | ApiMatch)[];
  predictions?: Record<string, MatchCardProps["prediction"]>;
  variant?: MatchCardProps["variant"];
  onSelect?: (match: Match | ApiMatch) => void;
}) {
  return (
    <motion.div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      variants={staggerContainerFast}
      initial="initial"
      animate="animate"
    >
      {matches.map((match) => {
        const matchId =
          "matchId" in match
            ? (match as ApiMatch).matchId
            : (match as Match).id;
        return (
          <motion.div key={matchId} variants={staggerChild}>
            <MatchCard
              match={match}
              prediction={predictions?.[matchId]}
              variant={variant}
              onClick={onSelect ? () => onSelect(match) : undefined}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
