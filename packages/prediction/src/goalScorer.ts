// xG Share Goal Scorer Prediction Model
// Estimates per-player goal probability using weighted xG-derived features

export interface PlayerGoalPrediction {
  modelName: "xg-share";
  modelVersion: "1.0.0";
  references: string[];
  inputFeatures: string[];
  playerId: string;
  playerName: string;
  goalProbability: number; // 0-1 probability of scoring at least one goal
  confidence: "low" | "medium" | "high";
  explanation: string;
}

interface GoalScorerInput {
  playerId: string;
  playerName: string;
  starterMinutes: number; // expected minutes (0-90)
  position: "GK" | "DEF" | "MID" | "FWD";
  recentXG: number; // xG over last 5 matches
  shotsPer90: number; // shots per 90 minutes
  isPenaltyTaker: boolean;
  opponentDefenceStrength: number; // 0-1, higher = weaker opponent defence
  teamExpectedGoals: number; // team total expected goals for this match
}

/** Position weight: forwards get highest base rate. */
function positionWeight(pos: GoalScorerInput["position"]): number {
  switch (pos) {
    case "FWD":
      return 1.0;
    case "MID":
      return 0.6;
    case "DEF":
      return 0.25;
    case "GK":
      return 0.02;
  }
}

/** Starter minutes weight: linear scale 0-1 for 0-90 minutes. */
function starterMinutesWeight(minutes: number): number {
  return Math.min(minutes, 90) / 90;
}

/**
 * Compute goal-scoring probability using xG Share formula:
 *   score = starterMinutesWeight * 0.25
 *         + positionWeight * 0.20
 *         + recentXGWeight * 0.25
 *         + shotsPer90Weight * 0.15
 *         + penaltyTakerWeight * 0.10
 *         + opponentWeaknessWeight * 0.05
 *
 * Then scales by team expected goals to produce a per-match probability.
 */
export function predictGoalScorer(input: GoalScorerInput): PlayerGoalPrediction {
  const smw = starterMinutesWeight(input.starterMinutes);
  const pw = positionWeight(input.position);

  // Recent xG weight: normalize by 1.0 (a player averaging 0.2 xG/match over 5 = 1.0 total)
  const recentXGWeight = Math.min(input.recentXG / 1.0, 1.0);

  // Shots per 90 weight: normalize by 5.0 shots/90 as elite benchmark
  const shotsPer90Weight = Math.min(input.shotsPer90 / 5.0, 1.0);

  // Penalty taker bonus
  const penaltyTakerWeight = input.isPenaltyTaker ? 1.0 : 0.0;

  // Opponent weakness weight (already 0-1)
  const opponentWeaknessWeight = input.opponentDefenceStrength;

  const rawScore =
    smw * 0.25 +
    pw * 0.20 +
    recentXGWeight * 0.25 +
    shotsPer90Weight * 0.15 +
    penaltyTakerWeight * 0.10 +
    opponentWeaknessWeight * 0.05;

  // Scale by team expected goals to get individual share
  // Then convert to at-least-one-goal probability via 1 - e^(-lambda)
  const playerExpectedGoals = rawScore * input.teamExpectedGoals * pw;
  const goalProbability = 1 - Math.exp(-playerExpectedGoals);

  const clamped = Math.max(0, Math.min(1, goalProbability));

  const confidence: PlayerGoalPrediction["confidence"] =
    clamped > 0.4 ? "high" : clamped > 0.2 ? "medium" : "low";

  const explanation =
    `xG Share score: ${rawScore.toFixed(3)} = ` +
    `minutes(${smw.toFixed(2)}*0.25) + ` +
    `position(${pw.toFixed(2)}*0.20) + ` +
    `recentXG(${recentXGWeight.toFixed(2)}*0.25) + ` +
    `shots(${shotsPer90Weight.toFixed(2)}*0.15) + ` +
    `penalty(${penaltyTakerWeight.toFixed(1)}*0.10) + ` +
    `oppWeakness(${opponentWeaknessWeight.toFixed(2)}*0.05). ` +
    `Player xG = ${playerExpectedGoals.toFixed(3)}, P(goal) = ${clamped.toFixed(3)}`;

  return {
    modelName: "xg-share",
    modelVersion: "1.0.0",
    references: [
      "StatBomb xG open-source framework (2018+)",
      "Caley, M. (2015) 'What are expected goals?', StatsBomb.",
      "Anzer, G. & Bauer, P. (2021) Expected Goals in Soccer: Explaining Match Results Using Predictive Analytics. MIT Sloan Sports Analytics Conference.",
    ],
    inputFeatures: [
      "starterMinutes",
      "position",
      "recentXG",
      "shotsPer90",
      "isPenaltyTaker",
      "opponentDefenceStrength",
      "teamExpectedGoals",
    ],
    playerId: input.playerId,
    playerName: input.playerName,
    goalProbability: Math.round(clamped * 1000) / 1000,
    confidence,
    explanation,
  };
}
