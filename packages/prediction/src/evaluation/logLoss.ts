import type { MatchOutcome } from "../models/dixonColes.js";
import type { OutcomeProbabilities } from "./brierScore.js";

export interface LogLossInput {
  probabilities: OutcomeProbabilities;
  actualOutcome: MatchOutcome;
}

export interface LogLossResult {
  modelName: "log-loss";
  modelVersion: "1.0.0";
  references: string[];
  explanation: string;
  evidence: {
    observations: number;
    epsilon: number;
  };
  confidence: "low" | "medium" | "high";
  score: number;
}

export function calculateLogLoss(rows: LogLossInput[], epsilon = 1e-15): LogLossResult {
  if (rows.length === 0) throw new Error("Log loss requires at least one row");

  const score = rows.reduce((sum, row) => {
    const probability = Math.max(epsilon, Math.min(1 - epsilon, row.probabilities[row.actualOutcome] / 100));
    return sum - Math.log(probability);
  }, 0) / rows.length;

  return {
    modelName: "log-loss",
    modelVersion: "1.0.0",
    references: ["Good, I.J. (1952) Rational decisions."],
    explanation: "Log loss penalizes the negative log probability assigned to the observed outcome, with input probabilities read as percentages.",
    evidence: { observations: rows.length, epsilon },
    confidence: rows.length >= 100 ? "high" : rows.length >= 30 ? "medium" : "low",
    score,
  };
}
