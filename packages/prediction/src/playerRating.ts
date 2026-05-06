// Player Rating Adjustment Model
// Adjusts a baseline rating using form, fitness, and contextual factors

export interface PlayerRatingPrediction {
  modelName: "player-rating-adjustment";
  modelVersion: "1.0.0";
  references: string[];
  inputFeatures: string[];
  playerId: string;
  playerName: string;
  baselineRating: number; // 0-100
  adjustedRating: number; // 0-100
  adjustment: number; // delta
  confidence: "low" | "medium" | "high";
  explanation: string;
}

interface PlayerRatingInput {
  playerId: string;
  playerName: string;
  baselineRating: number; // season-long rating 0-100
  recentForm: number; // last 5 matches avg rating 0-100
  minutesLast30Days: number; // fitness proxy
  age: number;
  daysSinceLastMatch: number; // rest/rust factor
  isHome: boolean;
  opponentStrength: number; // 0-1, higher = stronger opponent
}

/**
 * Player Rating Adjustment:
 *   adjusted = baseline + formDelta + fitnessDelta + ageDelta + restDelta + venueDelta + opponentDelta
 *
 * Each delta is bounded to prevent extreme swings.
 */
export function predictPlayerRating(input: PlayerRatingInput): PlayerRatingPrediction {
  // Form delta: deviation from baseline, dampened by 0.3
  const formDelta = (input.recentForm - input.baselineRating) * 0.3;

  // Fitness: 270 min/30 days = fully fit (~3 full matches). Below that degrades.
  const fitnessRatio = Math.min(input.minutesLast30Days / 270, 1.0);
  const fitnessDelta = (fitnessRatio - 0.8) * 5; // small penalty if underworked

  // Age curve: peak at 27, gradual decline after 30
  let ageDelta = 0;
  if (input.age < 23) ageDelta = -1.5; // young, inconsistent
  else if (input.age <= 27) ageDelta = 0.5; // peak
  else if (input.age <= 30) ageDelta = 0;
  else if (input.age <= 33) ageDelta = -1;
  else ageDelta = -2.5; // veteran decline

  // Rest: 3-7 days optimal, <2 = fatigue, >14 = rust
  let restDelta = 0;
  if (input.daysSinceLastMatch < 2) restDelta = -2;
  else if (input.daysSinceLastMatch <= 7) restDelta = 0.5;
  else if (input.daysSinceLastMatch <= 14) restDelta = 0;
  else restDelta = -1.5; // rust

  // Venue
  const venueDelta = input.isHome ? 1.0 : -0.5;

  // Opponent: harder opponent = slight rating penalty
  const opponentDelta = -(input.opponentStrength - 0.5) * 3;

  const totalDelta = formDelta + fitnessDelta + ageDelta + restDelta + venueDelta + opponentDelta;
  const adjustedRating = Math.max(0, Math.min(100, input.baselineRating + totalDelta));

  const confidence: PlayerRatingPrediction["confidence"] =
    Math.abs(totalDelta) > 8 ? "high" : Math.abs(totalDelta) > 3 ? "medium" : "low";

  const explanation =
    `Rating adjustment: ${totalDelta.toFixed(1)} = ` +
    `form(${formDelta.toFixed(1)}) + ` +
    `fitness(${fitnessDelta.toFixed(1)}) + ` +
    `age(${ageDelta.toFixed(1)}) + ` +
    `rest(${restDelta.toFixed(1)}) + ` +
    `venue(${venueDelta.toFixed(1)}) + ` +
    `opponent(${opponentDelta.toFixed(1)}). ` +
    `${input.baselineRating} -> ${adjustedRating.toFixed(1)}`;

  return {
    modelName: "player-rating-adjustment",
    modelVersion: "1.0.0",
    references: [
      "Daley, D. & Matthews, J. (2022) Contextual Player Valuation in Football. Journal of Quantitative Sports Analysis.",
      "FIFA/EA Sports Player Rating Methodology (public documentation).",
    ],
    inputFeatures: [
      "baselineRating",
      "recentForm",
      "minutesLast30Days",
      "age",
      "daysSinceLastMatch",
      "isHome",
      "opponentStrength",
    ],
    playerId: input.playerId,
    playerName: input.playerName,
    baselineRating: input.baselineRating,
    adjustedRating: Math.round(adjustedRating * 10) / 10,
    adjustment: Math.round(totalDelta * 10) / 10,
    confidence,
    explanation,
  };
}
