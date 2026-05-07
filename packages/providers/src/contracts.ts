// @lineupcast/providers — Unified FootballDataProvider contract
//
// Pure type definitions for the canonical data-provider interface.
// No HTTP calls, no runtime logic — only TypeScript interfaces.

import type { MatchStatus } from "@lineupcast/schema";

// ─── Provider Capabilities ────────────────────────────────────────────

/**
 * Capability matrix returned by every provider.
 * Each boolean indicates whether the provider can fulfil that data category.
 */
export interface ProviderCapabilities {
  fixtures: boolean;
  results: boolean;
  recentForm: boolean;
  h2h: boolean;
  squads: boolean;
  lineups: boolean;
  playerStats: boolean;
  injuries: boolean;
  referee: boolean;
  events: boolean;
}

// ─── Core Data Types ─────────────────────────────────────────────────

/**
 * A scheduled or in-progress fixture.
 * Compact representation focused on fixture-list display.
 */
export interface Fixture {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string; // ISO 8601
  venue?: string;
  referee?: string;
  status: MatchStatus;
  league: string;
  season?: string;
}

/**
 * Full match detail — extends Fixture with score, events, stats, and lineups.
 * Returned by getMatch() for the match-centre view.
 */
export interface MatchDetail extends Fixture {
  homeScore?: number;
  awayScore?: number;
  events: MatchEvent[];
  stats?: MatchStatistics;
  homeLineup?: LineupInfo;
  awayLineup?: LineupInfo;
}

/** A single match event (goal, card, substitution, VAR, etc.). */
export interface MatchEvent {
  minute: number;
  type: "goal" | "ownGoal" | "penalty" | "yellowCard" | "redCard" | "substitution" | "var";
  team: "home" | "away";
  player: string;
  assist?: string;
  detail?: string;
}

/** Aggregated match statistics. */
export interface MatchStatistics {
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homeCorners: number;
  awayCorners: number;
  homeFouls: number;
  awayFouls: number;
  homeXG?: number;
  awayXG?: number;
}

/**
 * A single completed match result for a specific team.
 * Used by getRecentMatches() to compute form.
 */
export interface MatchResult {
  matchId: string;
  date: string; // ISO 8601
  opponent: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
}

/**
 * Head-to-head aggregate between two teams.
 */
export interface H2HResult {
  totalMatches: number;
  teamAWins: number;
  draws: number;
  teamBWins: number;
  lastMeetings: MatchResult[];
}

/**
 * A single squad member.
 */
export interface SquadPlayer {
  playerId: string;
  name: string;
  position: string;
  number?: number;
  nationality?: string;
  age?: number;
  injured: boolean;
  injuryNote?: string;
}

/**
 * Lineup information for a single team in a match.
 */
export interface LineupInfo {
  formation: string;
  starters: SquadPlayer[];
  substitutes: SquadPlayer[];
  coach?: string;
}

/**
 * Season-level player statistics.
 */
export interface PlayerStats {
  appearances: number;
  goals: number;
  assists: number;
  xG?: number;
  xA?: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  rating?: number;
}

// ─── Health / Status ─────────────────────────────────────────────────

/**
 * Provider health and operational status.
 * Returned by getProviderStatus() for monitoring and UI display.
 */
export interface ProviderHealthStatus {
  status: "healthy" | "degraded" | "down";
  lastSync: string | null; // ISO 8601
  errorCount: number;
  lastError: string | null;
  capabilities: ProviderCapabilities;
  freshness: string; // human-readable, e.g. "2m ago", "stale", "never"
}

// ─── Unified Contract ────────────────────────────────────────────────

/**
 * The canonical data-provider contract for LineupCast.
 *
 * Every external data-source adapter implements this interface.
 * Consumers should call getProviderStatus() first to verify which
 * methods are actually supported before relying on their results.
 *
 * Providers that lack a capability should return empty/default values
 * rather than throwing, unless the call is fundamentally unsupported.
 */
export interface FootballDataProvider {
  /** Stable identifier, e.g. "football-data-org", "openfootball", "mock" */
  readonly id: string;

  /** Upcoming fixtures for a league, optionally filtered by date range. */
  getFixtures(league: string, from?: string, to?: string): Promise<Fixture[]>;

  /** Full match detail by match ID. */
  getMatch(matchId: string): Promise<MatchDetail>;

  /** Recent match results for a team (most recent first). */
  getRecentMatches(teamId: string, limit?: number): Promise<MatchResult[]>;

  /** Head-to-head record between two teams. */
  getHeadToHead(teamAId: string, teamBId: string): Promise<H2HResult>;

  /** Current squad / roster for a team. */
  getSquad(teamId: string): Promise<SquadPlayer[]>;

  /** Confirmed or projected lineup for a team in a specific match. */
  getLineup(matchId: string, teamId: string): Promise<LineupInfo>;

  /** Season-level statistics for a single player. */
  getPlayerStats(playerId: string, season?: string): Promise<PlayerStats>;

  /** Provider health, capabilities, and freshness metadata. */
  getProviderStatus(): Promise<ProviderHealthStatus>;
}
