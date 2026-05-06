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
}

export type ScriptInput = ScriptGenerationInput;
export type ScriptOutput = ScriptGenerationOutput;
