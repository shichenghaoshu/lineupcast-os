// Expected Booking (xB) Inspired Card Risk Model
// Inspired by: "Expected Booking: A Framework for Predicting Yellow Cards" (2024)

export type RedCardRisk = "low" | "medium" | "high";

export interface CardRiskPrediction {
  modelName: "xb-inspired-card-risk";
  modelVersion: "1.0.0";
  references: string[];
  inputFeatures: string[];
  playerId: string;
  playerName: string;
  yellowCardProbability: number; // 0-1
  redCardRisk: RedCardRisk; // categorical only, no precise percentage
  riskScore: number; // 0-1 composite
  confidence: "low" | "medium" | "high";
  explanation: string;
}

interface CardRiskInput {
  playerId: string;
  playerName: string;
  yellowCardsPer90: number; // historical yellow cards per 90
  foulsPer90: number; // fouls committed per 90
  position: "GK" | "DEF" | "MID" | "FWD";
  opponentDribbleThreat: number; // 0-1, opponent's dribble success rate
  refereeCardsPerMatch: number; // referee's avg cards per match
  matchPressure: number; // 0-1, derived from match importance (rivalry, relegation, etc.)
  minutesExpected: number; // expected playing time
}

/** Position risk factor: defenders and defensive midfielders higher risk. */
function positionRisk(pos: CardRiskInput["position"]): number {
  switch (pos) {
    case "DEF":
      return 0.9;
    case "MID":
      return 0.7;
    case "FWD":
      return 0.4;
    case "GK":
      return 0.15;
  }
}

/**
 * xB-inspired booking risk formula:
 *   risk = yellowCardsPer90 * 0.25
 *        + foulsPer90 * 0.25
 *        + positionRisk * 0.15
 *        + opponentDribbleThreat * 0.15
 *        + refereeCardsPerMatch * 0.15
 *        + matchPressure * 0.05
 *
 * Normalized to 0-1 range, then scaled by expected minutes.
 * Red card output is categorical only (low/medium/high) — no precise red percentage.
 */
export function predictCardRisk(input: CardRiskInput): CardRiskPrediction {
  // Normalize inputs to 0-1 scales
  const ycNorm = Math.min(input.yellowCardsPer90 / 0.5, 1.0); // 0.5 yc/90 = elite booker
  const foulsNorm = Math.min(input.foulsPer90 / 4.0, 1.0); // 4 fouls/90 = high
  const pr = positionRisk(input.position);
  const oppDribble = Math.min(input.opponentDribbleThreat, 1.0);
  const refNorm = Math.min(input.refereeCardsPerMatch / 5.0, 1.0); // 5 cards/match = very card-happy ref
  const pressure = Math.min(input.matchPressure, 1.0);

  const riskScore =
    ycNorm * 0.25 +
    foulsNorm * 0.25 +
    pr * 0.15 +
    oppDribble * 0.15 +
    refNorm * 0.15 +
    pressure * 0.05;

  // Scale by minutes (full match = 1.0 multiplier)
  const minutesMultiplier = Math.min(input.minutesExpected, 90) / 90;
  const adjustedRisk = riskScore * minutesMultiplier;

  // Convert to yellow card probability using sigmoid-like mapping
  const yellowCardProbability = 1 / (1 + Math.exp(-5 * (adjustedRisk - 0.3)));

  // Red card: categorical only
  let redCardRisk: RedCardRisk;
  if (adjustedRisk > 0.65) redCardRisk = "high";
  else if (adjustedRisk > 0.4) redCardRisk = "medium";
  else redCardRisk = "low";

  const confidence: CardRiskPrediction["confidence"] =
    adjustedRisk > 0.5 ? "high" : adjustedRisk > 0.3 ? "medium" : "low";

  const explanation =
    `xB risk score: ${riskScore.toFixed(3)} = ` +
    `yellowCards(${ycNorm.toFixed(2)}*0.25) + ` +
    `fouls(${foulsNorm.toFixed(2)}*0.25) + ` +
    `position(${pr.toFixed(2)}*0.15) + ` +
    `oppDribble(${oppDribble.toFixed(2)}*0.15) + ` +
    `referee(${refNorm.toFixed(2)}*0.15) + ` +
    `pressure(${pressure.toFixed(2)}*0.05). ` +
    `Adjusted for ${input.minutesExpected} min, P(yellow)=${yellowCardProbability.toFixed(3)}, ` +
    `red risk=${redCardRisk}`;

  return {
    modelName: "xb-inspired-card-risk",
    modelVersion: "1.0.0",
    references: [
      "Mariscal, G. et al. (2024) Expected Booking: A Framework for Predicting Yellow Cards in Football. arXiv.",
      "Decroos, T. et al. (2019) Actions Speak Louder than Goals: Valuing Player Actions in Soccer. KDD.",
    ],
    inputFeatures: [
      "yellowCardsPer90",
      "foulsPer90",
      "position",
      "opponentDribbleThreat",
      "refereeCardsPerMatch",
      "matchPressure",
      "minutesExpected",
    ],
    playerId: input.playerId,
    playerName: input.playerName,
    yellowCardProbability: Math.round(yellowCardProbability * 1000) / 1000,
    redCardRisk,
    riskScore: Math.round(adjustedRisk * 1000) / 1000,
    confidence,
    explanation,
  };
}
