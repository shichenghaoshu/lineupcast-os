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

/** Exported overlay payload (JSON serialisable). */
export interface OverlayExportPayload {
  version: string;
  generatedAt: string;
  scenes: Array<{
    id: string;
    type: string;
    svg: string;
    width: number;
    height: number;
  }>;
}
