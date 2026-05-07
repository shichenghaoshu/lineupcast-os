// @lineupcast/schema — shared types and validation contracts

// ─── Core Entities ───────────────────────────────────────────────────

export interface Team {
  id: string;
  name: string;
  shortName: string;
  league: string;
  country?: string;
  founded?: number;
  venue?: string;
  crest?: string;
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: PlayerPosition;
  number?: number;
  shirtNumber?: number;
  role?: string;
  nationality?: string;
  dateOfBirth?: string; // ISO 8601
  age?: number;
  height?: number; // cm
  weight?: number; // kg
  preferredFoot?: "left" | "right" | "both";
  marketValue?: number; // in EUR
  rating?: number; // 0-100 aggregate
  recentRating?: number;
  xGLast5?: number;
  shotsLast5?: number;
  assistsLast5?: number;
  foulsPer90?: number;
  yellowCardsLast10?: number;
  vaepAttack?: number;
  vaepDefense?: number;
  commentaryNote?: string;
  x?: number;
  y?: number;
  coordinates?: { x: number; y: number };
  injured?: boolean;
  injuryNote?: string;
  captain?: boolean;
  photo?: string;
  contractUntil?: string; // ISO 8601
}

export type PlayerPosition =
  | "GK"
  | "CB"
  | "LB"
  | "RB"
  | "LWB"
  | "RWB"
  | "CDM"
  | "DM"
  | "CM"
  | "CAM"
  | "AM"
  | "LM"
  | "RM"
  | "LW"
  | "RW"
  | "CF"
  | "ST";

export interface Lineup {
  matchId: string;
  teamId: string;
  formation: string; // e.g. "4-3-3"
  starters: Player[];
  substitutes: Player[];
  coach?: string;
}

export interface Match {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam?: Team;
  awayTeam?: Team;
  kickoff: string; // ISO 8601
  league: string;
  season?: string;
  matchday?: number;
  venue?: string;
  referee?: string;
  status: MatchStatus;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
}

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "abandoned";

// ─── Predictions ─────────────────────────────────────────────────────

export interface Prediction {
  matchId: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  confidence: "low" | "medium" | "high";
  btts?: number; // both teams to score probability
  over25?: number; // over 2.5 goals probability
  under25?: number;
  homeCleanSheet?: number;
  awayCleanSheet?: number;
  playerGoalPredictions?: PlayerGoalPrediction[];
  playerCardPredictions?: PlayerCardPrediction[];
}

export interface PlayerGoalPrediction {
  playerId: string;
  playerName: string;
  teamId: string;
  probability: number; // 0-1
  firstGoal?: number;
  anytime?: number;
  brace?: number;
  hatTrick?: number;
}

export interface PlayerCardPrediction {
  playerId: string;
  playerName: string;
  teamId: string;
  yellowCardProbability: number; // 0-1
  redCardProbability?: number; // 0-1
  redCardRiskLevel?: "low" | "medium" | "high";
  foulProbability: number; // 0-1
}

// ─── Match Context ───────────────────────────────────────────────────

export interface MatchStats {
  matchId: string;
  homeXG: number;
  awayXG: number;
  homePossession: number;
  awayPossession: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeCorners?: number;
  awayCorners?: number;
  homeFouls?: number;
  awayFouls?: number;
  homeYellowCards?: number;
  awayYellowCards?: number;
  homeRedCards?: number;
  awayRedCards?: number;
}

export interface H2HRecord {
  teamAId: string;
  teamBId: string;
  totalMatches: number;
  teamAWins: number;
  draws: number;
  teamBWins: number;
  lastMeetings: Match[];
}

export interface FormEntry {
  matchId: string;
  opponent: string;
  result: "W" | "D" | "L";
  goalsFor: number;
  goalsAgainst: number;
  date: string;
}

// ─── Commentary / Overlay ────────────────────────────────────────────

export interface CommentarySegment {
  id: string;
  matchId: string;
  order: number;
  heading: string;
  body: string;
  stats: Record<string, number | string>;
}

export interface OverlayScene {
  id: string;
  matchId: string;
  type: OverlaySceneType;
  title: string;
  subtitle?: string;
  data: Record<string, unknown>;
  duration?: number; // seconds
  animation?: string;
  priority: number; // higher = rendered first when overlapping
}

export type OverlaySceneType =
  | "lineup"
  | "prediction"
  | "h2h"
  | "form"
  | "stat-comparison"
  | "goal-prediction"
  | "card-prediction"
  | "custom";

// ─── AI Script Pipeline ──────────────────────────────────────────────

export interface ScriptInput {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  homeLineup?: Lineup;
  awayLineup?: Lineup;
  prediction: Prediction;
  h2h?: H2HRecord;
  homeForm?: FormEntry[];
  awayForm?: FormEntry[];
  matchStats?: MatchStats;
  overlays: OverlayScene[];
}

export interface ScriptOutput {
  segments: CommentarySegment[];
  overlays: OverlayScene[];
  metadata: {
    generatedAt: string;
    model?: string;
    providerId: string;
    tokensUsed?: number;
  };
}

// ─── Provider System ─────────────────────────────────────────────────

/** Individual capability a provider may support */
export type ProviderCapability =
  | "upcomingMatches"
  | "match"
  | "team"
  | "squad"
  | "lineup"
  | "matchStats"
  | "h2h"
  | "form"
  | "prediction";

/** Capability map: true = fully implemented, false = not available */
export type ProviderCapabilities = Partial<Record<ProviderCapability, boolean>>;

/** Overall readiness status for UI/API consumers */
export type ProviderStatus =
  | "full" // all declared capabilities implemented and ready
  | "partial" // some capabilities implemented
  | "placeholder" // stub — no real data yet
  | "needs-key"; // implemented but missing API key

export interface Provider {
  id: string;
  name: string;
  description: string;
  baseUrl?: string;
  requiresApiKey: boolean;
  tokenConfigured: boolean; // true if env var is set — never expose actual value
  supportedLeagues?: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay?: number;
  };
  /** Which data-fetching capabilities this provider supports */
  capabilities?: ProviderCapabilities;
  /** Overall implementation readiness — absent means "full" for backward compat */
  status?: ProviderStatus;
}

export interface FieldMapping {
  /** The provider's raw field name or JSON path */
  sourceField: string;
  /** The target field on our schema type */
  targetField: string;
  /** Optional transform function name */
  transform?: FieldTransform;
  /** Static fallback if source field is missing */
  fallback?: unknown;
}

export type FieldTransform =
  | "toUpperCase"
  | "toLowerCase"
  | "toNumber"
  | "toBoolean"
  | "toDate"
  | "splitComma"
  | "trim"
  | "iso8601";

// ─── Re-export barrel for consumers ──────────────────────────────────

export * from "./field-map-utils.js";
