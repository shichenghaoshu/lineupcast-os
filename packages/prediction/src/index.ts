// @lineupcast/prediction — paper-backed prediction lab.
// No LLM predicts. All models are deterministic, auditable algorithm layers.

import { predictDixonColes as predictLegacyDixonColes } from "./dixonColes.js";
import { predictCardRisk as predictPlayerCardRisk } from "./models/cardRisk.js";
import { predictTopGoalScorers as predictTeamGoalScorers } from "./models/goalScorer.js";

type BridgeTeam = {
  teamId?: string;
  id?: string;
  name?: string;
  shortName?: string;
};

type BridgePlayer = {
  playerId?: string;
  id?: string;
  name?: string;
  position?: string;
  recentRating?: number;
  xGLast5?: number;
  shotsLast5?: number;
  foulsPer90?: number;
  yellowCardsLast10?: number;
  vaepAttack?: number;
  vaepDefense?: number;
};

type BridgeLineupTeam = {
  teamId?: string;
  teamName?: string;
  players?: BridgePlayer[];
};

export type BridgePredictionInput = {
  matchId?: string;
  homeTeam?: BridgeTeam;
  awayTeam?: BridgeTeam;
  lineups?: {
    home?: BridgeLineupTeam;
    away?: BridgeLineupTeam;
  };
};

export type BridgePredictionOutput = {
  matchId: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  modelName: string;
  modelVersion: string;
  confidence: number;
  explanation: string;
  inputFeatures: string[];
  models: { name: string; version: string; reference: string }[];
  explanations: string[];
  goalScorers: { player: string; team: string; probability: number }[];
  cardRisks: {
    player: string;
    team: string;
    yellowRisk: number;
    redRisk: "low" | "medium" | "high";
    redCardRisk: "low" | "medium" | "high";
  }[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function percent(value: number): number {
  return Math.round(value * 100);
}

function rebalancePercentages(homeWin: number, draw: number, awayWin: number): {
  homeWin: number;
  draw: number;
  awayWin: number;
} {
  const values = [percent(homeWin), percent(draw), percent(awayWin)];
  const drift = 100 - values.reduce((sum, value) => sum + value, 0);
  const largestIndex = values.indexOf(Math.max(...values));
  values[largestIndex] += drift;
  return { homeWin: values[0] ?? 0, draw: values[1] ?? 0, awayWin: values[2] ?? 0 };
}

function playerId(player: BridgePlayer, index: number): string {
  return player.playerId ?? player.id ?? `player-${index + 1}`;
}

function mapPosition(position?: string): "GK" | "DEF" | "MID" | "FWD" {
  const normalized = (position ?? "").toUpperCase();
  if (normalized === "GK") return "GK";
  if (["CB", "LB", "RB", "LWB", "RWB", "DEF"].includes(normalized)) return "DEF";
  if (["ST", "CF", "LW", "RW", "FWD"].includes(normalized)) return "FWD";
  return "MID";
}

function teamStrength(team: BridgeLineupTeam | undefined): { attack: number; defence: number } {
  const players = team?.players ?? [];
  if (players.length === 0) return { attack: 1, defence: 1 };

  const attack =
    players.reduce((sum, player) => {
      const rating = (player.recentRating ?? 7) / 7;
      const xg = (player.xGLast5 ?? 0.4) / 0.6;
      const vaep = (player.vaepAttack ?? 0.35) / 0.35;
      return sum + rating * 0.35 + xg * 0.35 + vaep * 0.3;
    }, 0) / players.length;

  const defenceQuality =
    players.reduce((sum, player) => {
      const rating = (player.recentRating ?? 7) / 7;
      const vaep = (player.vaepDefense ?? 0.35) / 0.35;
      return sum + rating * 0.45 + vaep * 0.55;
    }, 0) / players.length;

  return {
    attack: clamp(attack, 0.72, 1.38),
    defence: clamp(2 - defenceQuality, 0.72, 1.38),
  };
}

function confidenceScore(confidence: "low" | "medium" | "high"): number {
  if (confidence === "high") return 0.82;
  if (confidence === "medium") return 0.68;
  return 0.52;
}

function buildGoalScorers(
  team: BridgeLineupTeam | undefined,
  teamName: string,
  expectedGoals: number,
): { player: string; team: string; probability: number }[] {
  const players = team?.players ?? [];
  if (players.length === 0) return [];

  return predictTeamGoalScorers({
    teamExpectedGoals: expectedGoals,
    maxResults: 3,
    players: players.map((player, index) => ({
      playerId: playerId(player, index),
      playerName: player.name ?? `Player ${index + 1}`,
      expectedMinutes: 90,
      position: mapPosition(player.position),
      recentXG: player.xGLast5 ?? 0.2,
      shotsPer90: (player.shotsLast5 ?? 2) / 5,
      isPenaltyTaker: ["ST", "CF"].includes((player.position ?? "").toUpperCase()) && index > players.length - 3,
    })),
  }).predictions.map((prediction) => ({
    player: prediction.playerName,
    team: teamName,
    probability: Math.round(prediction.scorerProbability),
  }));
}

function buildCardRisks(
  team: BridgeLineupTeam | undefined,
  teamName: string,
): BridgePredictionOutput["cardRisks"] {
  const players = team?.players ?? [];
  return players
    .map((player, index) =>
      predictPlayerCardRisk({
        playerId: playerId(player, index),
        playerName: player.name ?? `Player ${index + 1}`,
        yellowCardsPer90: (player.yellowCardsLast10 ?? 1) / 10,
        foulsPer90: player.foulsPer90 ?? 1,
        position: mapPosition(player.position),
        opponentDribblesPer90: 12,
        refereeCardsPerMatch: 4,
        matchPressure: 0.55,
        minutesExpected: 90,
      }),
    )
    .sort((left, right) => right.yellowCardProbability - left.yellowCardProbability)
    .slice(0, 3)
    .map((risk) => ({
      player: risk.playerName,
      team: teamName,
      yellowRisk: Math.round(risk.yellowCardProbability),
      redRisk: risk.redCardRisk,
      redCardRisk: risk.redCardRisk,
    }));
}

/**
 * Bridge-safe wrapper used by the FastAPI subprocess.
 *
 * It accepts the loose JSON shape emitted by the Python service and returns the
 * stable API prediction contract. The model remains deterministic and local.
 */
export function predictMatch(input: BridgePredictionInput): BridgePredictionOutput {
  const matchId = input.matchId ?? "demo";
  const homeTeamName = input.lineups?.home?.teamName ?? input.homeTeam?.name ?? "Home";
  const awayTeamName = input.lineups?.away?.teamName ?? input.awayTeam?.name ?? "Away";
  const homeTeamId = input.lineups?.home?.teamId ?? input.homeTeam?.teamId ?? input.homeTeam?.id ?? "home";
  const awayTeamId = input.lineups?.away?.teamId ?? input.awayTeam?.teamId ?? input.awayTeam?.id ?? "away";
  const homeStrength = teamStrength(input.lineups?.home);
  const awayStrength = teamStrength(input.lineups?.away);
  const outcome = predictLegacyDixonColes({
    homeTeam: { teamId: homeTeamId, attack: homeStrength.attack, defence: homeStrength.defence },
    awayTeam: { teamId: awayTeamId, attack: awayStrength.attack, defence: awayStrength.defence },
    matchesPlayed: Math.max(input.lineups?.home?.players?.length ?? 0, input.lineups?.away?.players?.length ?? 0, 6),
  });
  const percentages = rebalancePercentages(outcome.homeWin, outcome.draw, outcome.awayWin);
  const goalScorers = [
    ...buildGoalScorers(input.lineups?.home, homeTeamName, outcome.expectedHomeGoals),
    ...buildGoalScorers(input.lineups?.away, awayTeamName, outcome.expectedAwayGoals),
  ]
    .sort((left, right) => right.probability - left.probability)
    .slice(0, 4);
  const cardRisks = [
    ...buildCardRisks(input.lineups?.home, homeTeamName),
    ...buildCardRisks(input.lineups?.away, awayTeamName),
  ]
    .sort((left, right) => right.yellowRisk - left.yellowRisk)
    .slice(0, 4);

  return {
    matchId,
    ...percentages,
    expectedHomeGoals: outcome.expectedHomeGoals,
    expectedAwayGoals: outcome.expectedAwayGoals,
    modelName: "Dixon-Coles + Player Rating Adjustment",
    modelVersion: "1.0.0",
    confidence: confidenceScore(outcome.confidence),
    explanation: outcome.explanations.join(" "),
    inputFeatures: [
      "lineup.recentRating",
      "lineup.xGLast5",
      "lineup.vaepAttack",
      "lineup.vaepDefense",
      "lineup.foulsPer90",
      "lineup.yellowCardsLast10",
    ],
    models: [
      {
        name: "Dixon-Coles",
        version: outcome.modelVersion,
        reference: "docs/model-cards/dixon-coles.md",
      },
      {
        name: "xG Share",
        version: "1.0.0",
        reference: "docs/model-cards/xg-share.md",
      },
      {
        name: "xB-Inspired Card Risk",
        version: "2.0.0",
        reference: "docs/model-cards/xb-inspired-card-risk.md",
      },
    ],
    explanations: [
      ...outcome.explanations,
      `Lineup bridge estimated ${homeTeamName} and ${awayTeamName} strengths from player ratings, xG, VAEP, and discipline features.`,
    ],
    goalScorers,
    cardRisks,
  };
}

export {
  buildIndependentPoissonMatrix,
  poissonPmf,
  type PoissonScoreProbability,
} from "./models/poisson.js";

export {
  timeDecayWeight,
  weightedAverage,
  type TimeDecayOptions,
} from "./models/timeDecay.js";

export {
  predictDixonColesFromHistory,
  type Confidence,
  type DixonColesHistoryInput,
  type DixonColesPrediction,
  type MatchHistoryRecord,
  type MatchOutcome,
} from "./models/dixonColes.js";

export {
  adjustLineupRatings,
  type LineupRatingAdjustmentInput,
  type LineupRatingAdjustmentResult,
  type PlayerRatingAdjustment,
  type PlayerRatingAdjustmentInput,
} from "./models/playerRatingAdjustment.js";

export {
  predictTopGoalScorers,
  type GoalScorerPlayerInput,
  type GoalScorerPrediction,
  type PlayerPosition,
  type TopGoalScorerInput,
  type TopGoalScorerPredictionResult,
} from "./models/goalScorer.js";

export {
  predictCardRisk,
  type CardRiskInput,
  type CardRiskPrediction,
  type CardRiskPosition,
  type RedCardRisk,
} from "./models/cardRisk.js";

export {
  calculateBrierScore,
  type BrierScoreInput,
  type BrierScoreResult,
  type OutcomeProbabilities,
} from "./evaluation/brierScore.js";

export {
  calculateLogLoss,
  type LogLossInput,
  type LogLossResult,
} from "./evaluation/logLoss.js";

export {
  calculateCalibration,
  type CalibrationBucket,
  type CalibrationInput,
  type CalibrationResult,
} from "./evaluation/calibration.js";

export {
  runBacktest,
  type BacktestInput,
  type BacktestPrediction,
  type BacktestResult,
} from "./evaluation/backtest.js";

// Deterministic Explanation Layer
export {
  explain,
  type ExplanationResult,
} from "./explanation.js";
