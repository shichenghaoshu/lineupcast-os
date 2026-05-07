// @lineupcast/ai-script — types for AI commentary script generation

import type { Match, Prediction } from "@lineupcast/schema";

// ── Lineup types (mirrors Python MatchLineups / LineupTeam / Player) ──

export interface PlayerCoordinates {
  x: number;
  y: number;
}

export interface LineupPlayer {
  number: number;
  name: string;
  position: string;
  role: string;
  age: number;
  nationality: string;
  recentRating: number;
  xGLast5: number;
  shotsLast5: number;
  assistsLast5: number;
  foulsPer90: number;
  yellowCardsLast10: number;
  vaepAttack: number;
  vaepDefense: number;
  commentaryNote: string;
  coordinates: PlayerCoordinates;
}

export interface LineupTeam {
  teamId: string;
  teamName: string;
  formation: string;
  players: LineupPlayer[];
}

export interface MatchLineups {
  matchId: string;
  home: LineupTeam;
  away: LineupTeam;
}

// ── Goal scorer / card risk (mirrors Python GoalScorer / CardRisk) ──

export interface GoalScorer {
  player: string;
  team: string;
  probability: number;
}

export interface CardRisk {
  player: string;
  team: string;
  yellowRisk: number;
  redRisk: number;
}

// ── Grounding types ──

/**
 * Category of data source for grounding traceability.
 */
export type SourceType = "prediction" | "lineup" | "stats" | "form";

/**
 * A reference to a specific input field that contributed to a sentence.
 * Field paths use JSON pointer notation (e.g., "prediction.homeWin", "lineups.home.teamName").
 */
export interface SourceRef {
  /** JSON-pointer-style path into the ScriptGenerationInput */
  field: string;
  /** The value that was read from this field */
  value: unknown;
  /** Which provider supplied this field (e.g., "lineup-provider", "prediction-model") */
  provider: string;
  /** High-level category of the data source */
  sourceType?: SourceType;
  /** JSON-pointer-style path (alias for field, for grounding report clarity) */
  sourcePath?: string;
  /** The raw value from the source (alias for value, for grounding report clarity) */
  sourceValue?: unknown;
  /** Per-source confidence score (0-1) indicating data reliability */
  confidence?: number;
}

/**
 * Grounding report for a single sentence in the generated script.
 */
export interface GroundingReport {
  /** Zero-based index of this sentence across the entire script */
  sentenceIndex: number;
  /** The actual sentence text */
  sentence: string;
  /** Input fields that contributed to this sentence */
  sources: SourceRef[];
  /** 0-1 confidence: how much of the sentence is grounded in data vs template filler */
  confidence: number;
}

// ── Script generation types ──

export type ScriptLanguage = "zh" | "en" | "bilingual";

export type ScriptStyle =
  | "professional"
  | "short-video"
  | "passionate"
  | "neutral"
  | "broadcast"
  | "bilingual";

export type ScriptDuration = "15s" | "30s" | "1min" | "3min";

export type BilingualMode = "separate" | "paragraph-by-paragraph";

export interface ScriptGenerationInput {
  match: Match;
  lineups: MatchLineups;
  prediction: Prediction;
  goalScorers: GoalScorer[];
  cardRisks: CardRisk[];
  style: ScriptStyle;
  duration: ScriptDuration;
  language?: ScriptLanguage;
  audience?: string;
  bilingualMode?: BilingualMode;
}

export interface ScriptSections {
  opening: string;
  lineupIntro: string;
  tacticalBattle: string;
  predictionBrief: string;
  playerFocus: string;
  disciplineRisk: string;
  shortVideoCaption: string;
  teleprompterText: string;
}

export interface ScriptGenerationOutput extends ScriptSections {
  language: ScriptLanguage;
  style: Exclude<ScriptStyle, "bilingual">;
  duration: ScriptDuration;
  audience?: string;
  bilingualMode?: BilingualMode;
  grounding?: GroundingReport[];
  /** Disclaimer text included in all outputs. AI narrates, never predicts. */
  disclaimer: string;
}

export type ScriptInput = ScriptGenerationInput;
export type ScriptOutput = ScriptGenerationOutput;
