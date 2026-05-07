// @lineupcast/overlay-renderer — type definitions for overlay scenes

import type { Match, Team, Player, Prediction } from "@lineupcast/schema";

/** A player positioned on the pitch for lineup graphics. */
export interface LineupPlayer extends Player {
  /** Normalised x position 0-1 across pitch width. */
  x: number;
  /** Normalised y position 0-1 across pitch height. */
  y: number;
}

/** Input for the 16:9 lineup graphic scene. */
export interface LineupSceneInput {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  homePlayers: LineupPlayer[];
  awayPlayers: LineupPlayer[];
  homeFormation: string;
  awayFormation: string;
}

/** Input for the 9:16 short-video card scene. */
export interface ShortVideoInput {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  prediction: Prediction;
  homePlayers?: LineupPlayer[];
  awayPlayers?: LineupPlayer[];
}

/** Input for the player lower-third subtitle bar. */
export interface LowerThirdInput {
  player: Player;
  team: Team;
  stats?: Record<string, string | number>;
}

/** Input for the prediction probability strip. */
export interface PredictionStripInput {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  prediction: Prediction;
}

/** Discipline risk alert data for card warning overlays. */
export interface DisciplineRiskPlayer {
  name: string;
  team: string;
  yellowRisk: number;   // 0-100
  redRisk: "low" | "medium" | "high";
  foulsPer90: number;
}

/** Input for the discipline risk alert overlay. */
export interface DisciplineRiskAlertInput {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  players: DisciplineRiskPlayer[];
  dataSource?: string;
}

/** Aspect ratio for overlay scenes. */
export type AspectRatio = "16:9" | "9:16";

/** Exported overlay payload (JSON serialisable). */
export interface OverlayExportPayload {
  version: string;
  generatedAt: string;
  dataSource: string;
  disclaimer: string;
  scenes: Array<{
    id: string;
    type: string;
    svg: string;
    width: number;
    height: number;
  }>;
}

/** A single entry in the overlay export audit trail. */
export interface OverlayExportHistoryEntry {
  id: string;
  exportedAt: string;
  format: "json" | "svg" | "png" | "html" | "browser-source";
  sceneCount: number;
  dataSource: string;
  url?: string;
}

/** Full history of overlay exports for audit / replay. */
export interface OverlayExportHistory {
  matchId: string;
  entries: OverlayExportHistoryEntry[];
}
