import { calculateBrierScore, type BrierScoreResult } from "./brierScore.js";
import { calculateCalibration, type CalibrationResult } from "./calibration.js";
import { calculateLogLoss, type LogLossResult } from "./logLoss.js";
import {
  predictDixonColesFromHistory,
  type DixonColesPrediction,
  type MatchHistoryRecord,
  type MatchOutcome,
} from "../models/dixonColes.js";
import { toDate } from "../models/timeDecay.js";

export interface BacktestInput {
  matches: MatchHistoryRecord[];
  startIndex?: number;
  halfLifeDays?: number;
  maxGoals?: number;
}

export interface BacktestPrediction {
  match: MatchHistoryRecord;
  prediction: DixonColesPrediction;
  actualOutcome: MatchOutcome;
}

export interface BacktestResult {
  modelName: "dixon-coles-backtest";
  modelVersion: "1.0.0";
  references: string[];
  explanation: string;
  evidence: {
    matchesEvaluated: number;
    trainingWindowStartIndex: number;
  };
  confidence: "low" | "medium" | "high";
  predictions: BacktestPrediction[];
  metrics: {
    brierScore: BrierScoreResult;
    logLoss: LogLossResult;
    calibration: CalibrationResult;
  };
}

function actualOutcome(match: MatchHistoryRecord): MatchOutcome {
  if (match.homeGoals > match.awayGoals) return "homeWin";
  if (match.homeGoals < match.awayGoals) return "awayWin";
  return "draw";
}

export function runBacktest(input: BacktestInput): BacktestResult {
  const matches = [...input.matches].sort((left, right) => toDate(left.date).getTime() - toDate(right.date).getTime());
  const startIndex = input.startIndex ?? Math.max(1, Math.floor(matches.length * 0.7));
  if (startIndex < 1 || startIndex >= matches.length) throw new Error("startIndex must leave at least one training and one evaluation match");

  const predictions: BacktestPrediction[] = [];
  for (let index = startIndex; index < matches.length; index += 1) {
    const match = matches[index];
    if (!match) continue;

    const prediction = predictDixonColesFromHistory({
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      matchHistory: matches.slice(0, index),
      asOfDate: match.date,
      halfLifeDays: input.halfLifeDays,
      maxGoals: input.maxGoals,
    });

    predictions.push({ match, prediction, actualOutcome: actualOutcome(match) });
  }

  const scoringRows = predictions.map((row) => ({
    probabilities: {
      homeWin: row.prediction.homeWin,
      draw: row.prediction.draw,
      awayWin: row.prediction.awayWin,
    },
    actualOutcome: row.actualOutcome,
  }));
  const calibrationRows = predictions.map((row) => {
    const probability = row.prediction[row.actualOutcome];
    return { predictedProbability: probability, actual: true };
  });

  return {
    modelName: "dixon-coles-backtest",
    modelVersion: "1.0.0",
    references: ["Walk-forward validation for time-series sports forecasting."],
    explanation: "Backtest trains the Dixon-Coles history model only on matches before each evaluated fixture, then scores probabilistic outcomes.",
    evidence: {
      matchesEvaluated: predictions.length,
      trainingWindowStartIndex: startIndex,
    },
    confidence: predictions.length >= 100 ? "high" : predictions.length >= 30 ? "medium" : "low",
    predictions,
    metrics: {
      brierScore: calculateBrierScore(scoringRows),
      logLoss: calculateLogLoss(scoringRows),
      calibration: calculateCalibration(calibrationRows),
    },
  };
}
