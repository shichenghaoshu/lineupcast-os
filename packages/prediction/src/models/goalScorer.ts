import type { Confidence } from "./dixonColes.js";

export type PlayerPosition = "GK" | "DEF" | "MID" | "FWD";

export interface GoalScorerPlayerInput {
  playerId: string;
  playerName: string;
  expectedMinutes: number;
  position: PlayerPosition;
  recentXG: number;
  shotsPer90: number;
  isPenaltyTaker?: boolean;
}

export interface TopGoalScorerInput {
  players: GoalScorerPlayerInput[];
  teamExpectedGoals: number;
  maxResults?: number;
}

export interface GoalScorerPrediction {
  playerId: string;
  playerName: string;
  scorerProbability: number;
  expectedGoals: number;
  evidence: {
    xgShare: number;
    minutesFactor: number;
    shotFactor: number;
    positionFactor: number;
    penaltyFactor: number;
  };
}

export interface TopGoalScorerPredictionResult {
  modelName: "xg-share-top-scorer";
  modelVersion: "1.0.0";
  references: string[];
  explanation: string;
  evidence: {
    playersConsidered: number;
    teamExpectedGoals: number;
    returnedPlayers: number;
  };
  confidence: Confidence;
  predictions: GoalScorerPrediction[];
}

function positionFactor(position: PlayerPosition): number {
  if (position === "FWD") return 1;
  if (position === "MID") return 0.62;
  if (position === "DEF") return 0.24;
  return 0.02;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function predictTopGoalScorers(input: TopGoalScorerInput): TopGoalScorerPredictionResult {
  const maxResults = input.maxResults ?? 5;
  const rawPlayers = input.players.map((player) => {
    const minutesFactor = clamp(player.expectedMinutes, 0, 90) / 90;
    const shotFactor = clamp(player.shotsPer90 / 5, 0, 1);
    const xgFactor = clamp(player.recentXG / 2, 0, 1);
    const penaltyFactor = player.isPenaltyTaker ? 1 : 0;
    const posFactor = positionFactor(player.position);
    const weightedShare = minutesFactor * (xgFactor * 0.45 + shotFactor * 0.2 + posFactor * 0.25 + penaltyFactor * 0.1);

    return {
      player,
      weightedShare,
      evidence: {
        xgShare: xgFactor,
        minutesFactor,
        shotFactor,
        positionFactor: posFactor,
        penaltyFactor,
      },
    };
  });

  const shareTotal = rawPlayers.reduce((sum, player) => sum + player.weightedShare, 0);
  const ranked = rawPlayers
    .map((entry) => {
      const teamShare = shareTotal > 0 ? entry.weightedShare / shareTotal : 1 / Math.max(1, rawPlayers.length);
      const expectedGoals = teamShare * Math.max(0, input.teamExpectedGoals);
      const atLeastOne = 1 - Math.exp(-expectedGoals);
      return { ...entry, expectedGoals, atLeastOne };
    })
    .sort((left, right) => right.atLeastOne - left.atLeastOne)
    .slice(0, maxResults);

  const topTotal = ranked.reduce((sum, entry) => sum + entry.atLeastOne, 0);
  const predictions = ranked.map((entry) => ({
    playerId: entry.player.playerId,
    playerName: entry.player.playerName,
    scorerProbability: topTotal > 0 ? (entry.atLeastOne / topTotal) * 100 : 0,
    expectedGoals: round(entry.expectedGoals),
    evidence: {
      xgShare: round(entry.evidence.xgShare),
      minutesFactor: round(entry.evidence.minutesFactor),
      shotFactor: round(entry.evidence.shotFactor),
      positionFactor: entry.evidence.positionFactor,
      penaltyFactor: entry.evidence.penaltyFactor,
    },
  }));

  const confidence: Confidence = input.players.length >= 8 ? "high" : input.players.length >= 5 ? "medium" : "low";

  return {
    modelName: "xg-share-top-scorer",
    modelVersion: "1.0.0",
    references: [
      "StatsBomb expected goals model documentation.",
      "Anzer, G. & Bauer, P. (2021) A Goal Scoring Probability Model for Shots Based on Synchronized Positional and Event Data.",
    ],
    explanation: "Top scorer probabilities use each player's xG share, expected minutes, shot volume, position, and penalty role, then normalize the top five to percentages.",
    evidence: {
      playersConsidered: input.players.length,
      teamExpectedGoals: input.teamExpectedGoals,
      returnedPlayers: predictions.length,
    },
    confidence,
    predictions,
  };
}
