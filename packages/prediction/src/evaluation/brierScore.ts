import type { MatchOutcome } from "../models/dixonColes.js";

export interface OutcomeProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
}

export interface BrierScoreInput {
  probabilities: OutcomeProbabilities;
  actualOutcome: MatchOutcome;
}

export interface BrierScoreResult {
  modelName: "brier-score";
  modelVersion: "1.0.0";
  references: string[];
  explanation: string;
  evidence: {
    observations: number;
  };
  confidence: "low" | "medium" | "high";
  score: number;
}

const outcomes: MatchOutcome[] = ["homeWin", "draw", "awayWin"];

export function calculateBrierScore(rows: BrierScoreInput[]): BrierScoreResult {
  if (rows.length === 0) throw new Error("Brier score requires at least one row");

  const score = rows.reduce((sum, row) => {
    const rowScore = outcomes.reduce((rowSum, outcome) => {
      const predicted = row.probabilities[outcome] / 100;
      const actual = row.actualOutcome === outcome ? 1 : 0;
      return rowSum + (predicted - actual) ** 2;
    }, 0);
    return sum + rowScore;
  }, 0) / rows.length;

  return {
    modelName: "brier-score",
    modelVersion: "1.0.0",
    references: ["Brier, G.W. (1950) Verification of forecasts expressed in terms of probability."],
    explanation: "Multiclass Brier score averages squared error across home-win, draw, and away-win probabilities supplied as percentages.",
    evidence: { observations: rows.length },
    confidence: rows.length >= 100 ? "high" : rows.length >= 30 ? "medium" : "low",
    score,
  };
}
