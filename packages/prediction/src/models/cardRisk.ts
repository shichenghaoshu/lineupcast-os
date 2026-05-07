import type { Confidence } from "./dixonColes.js";

export type RedCardRisk = "low" | "medium" | "high";
export type CardRiskPosition = "GK" | "DEF" | "MID" | "FWD";

export interface CardRiskInput {
  playerId: string;
  playerName: string;
  yellowCardsPer90: number;
  foulsPer90: number;
  position: CardRiskPosition;
  opponentDribblesPer90: number;
  refereeCardsPerMatch: number;
  matchPressure: number;
  minutesExpected: number;
}

export interface CardRiskPrediction {
  modelName: "xb-inspired-card-risk";
  modelVersion: "2.0.0";
  references: string[];
  explanation: string;
  evidence: {
    normalizedFeatures: {
      yellowCards: number;
      fouls: number;
      position: number;
      dribbles: number;
      referee: number;
      pressure: number;
      minutes: number;
    };
  };
  confidence: Confidence;
  playerId: string;
  playerName: string;
  yellowCardProbability: number;
  redCardRisk: RedCardRisk;
  riskScore: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function positionRisk(position: CardRiskPosition): number {
  if (position === "DEF") return 0.9;
  if (position === "MID") return 0.72;
  if (position === "FWD") return 0.4;
  return 0.12;
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Safe fallback for missing numeric inputs. */
const SAFE_DEFAULT = 0;

function safeValue(value: number | undefined, fallback: number = SAFE_DEFAULT): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return value;
}

export function predictCardRisk(input: CardRiskInput): CardRiskPrediction {
  // Guard against missing/invalid inputs with graceful defaults
  const safeYellowCards = safeValue(input.yellowCardsPer90, 0.1);
  const safeFouls = safeValue(input.foulsPer90, 1.0);
  const safeDribbles = safeValue(input.opponentDribblesPer90, 10);
  const safeReferee = safeValue(input.refereeCardsPerMatch, 3.5);
  const safePressure = safeValue(input.matchPressure, 0.5);
  const safeMinutes = safeValue(input.minutesExpected, 90);

  const yellowCards = clamp(safeYellowCards / 0.5, 0, 1);
  const fouls = clamp(safeFouls / 4, 0, 1);
  const position = positionRisk(input.position);
  const dribbles = clamp(safeDribbles / 18, 0, 1);
  const referee = clamp(safeReferee / 5, 0, 1);
  const pressure = clamp(safePressure, 0, 1);
  const minutes = clamp(safeMinutes, 0, 90) / 90;

  // Track how many features had real (non-default) data for confidence scoring
  let dataPointsAvailable = 0;
  if (input.yellowCardsPer90 !== undefined && Number.isFinite(input.yellowCardsPer90)) dataPointsAvailable++;
  if (input.foulsPer90 !== undefined && Number.isFinite(input.foulsPer90)) dataPointsAvailable++;
  if (input.opponentDribblesPer90 !== undefined && Number.isFinite(input.opponentDribblesPer90)) dataPointsAvailable++;
  if (input.refereeCardsPerMatch !== undefined && Number.isFinite(input.refereeCardsPerMatch)) dataPointsAvailable++;
  if (input.matchPressure !== undefined && Number.isFinite(input.matchPressure)) dataPointsAvailable++;
  if (input.minutesExpected !== undefined && Number.isFinite(input.minutesExpected)) dataPointsAvailable++;

  const baseRisk = yellowCards * 0.26 + fouls * 0.24 + position * 0.14 + dribbles * 0.14 + referee * 0.16 + pressure * 0.06;
  const riskScore = baseRisk * minutes;
  const yellowCardProbability = clamp(1 / (1 + Math.exp(-7 * (riskScore - 0.34))), 0, 1) * 100;

  // Red card risk is ALWAYS categorical — never numeric
  const redCardRisk: RedCardRisk = riskScore >= 0.68 ? "high" : riskScore >= 0.42 ? "medium" : "low";

  // Confidence is based on data availability and expected minutes
  let confidence: Confidence;
  if (minutes < 0.5) {
    confidence = "low";
  } else if (dataPointsAvailable >= 5 && riskScore > 0.35) {
    confidence = "high";
  } else if (dataPointsAvailable >= 3) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    modelName: "xb-inspired-card-risk",
    modelVersion: "2.0.0",
    references: [
      "Expected Booking feature framing for football card risk models.",
      "Decroos, T. et al. (2019) Actions Speak Louder than Goals: Valuing Player Actions in Soccer.",
    ],
    explanation: "xB-inspired card risk blends booking history, foul rate, position, opponent dribble load, referee strictness, pressure, and expected minutes. Red-card output is intentionally categorical.",
    evidence: {
      normalizedFeatures: {
        yellowCards: round(yellowCards),
        fouls: round(fouls),
        position,
        dribbles: round(dribbles),
        referee: round(referee),
        pressure,
        minutes: round(minutes),
      },
    },
    confidence,
    playerId: input.playerId,
    playerName: input.playerName,
    yellowCardProbability,
    redCardRisk,
    riskScore: riskScore * 100,
  };
}
