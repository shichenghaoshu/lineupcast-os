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

export function predictCardRisk(input: CardRiskInput): CardRiskPrediction {
  const yellowCards = clamp(input.yellowCardsPer90 / 0.5, 0, 1);
  const fouls = clamp(input.foulsPer90 / 4, 0, 1);
  const position = positionRisk(input.position);
  const dribbles = clamp(input.opponentDribblesPer90 / 18, 0, 1);
  const referee = clamp(input.refereeCardsPerMatch / 5, 0, 1);
  const pressure = clamp(input.matchPressure, 0, 1);
  const minutes = clamp(input.minutesExpected, 0, 90) / 90;
  const baseRisk = yellowCards * 0.26 + fouls * 0.24 + position * 0.14 + dribbles * 0.14 + referee * 0.16 + pressure * 0.06;
  const riskScore = baseRisk * minutes;
  const yellowCardProbability = clamp(1 / (1 + Math.exp(-7 * (riskScore - 0.34))), 0, 1) * 100;
  const redCardRisk: RedCardRisk = riskScore >= 0.68 ? "high" : riskScore >= 0.42 ? "medium" : "low";
  const confidence: Confidence = minutes < 0.5 ? "low" : riskScore > 0.55 ? "high" : riskScore > 0.35 ? "medium" : "low";

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
