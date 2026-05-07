/**
 * Per-League Calibration Report generator.
 *
 * Aggregates evaluation metrics (Brier, log loss, ECE, reliability curve)
 * for predictions grouped by league, with per-outcome-class breakdown
 * (home/draw/away) and favorite/underdog segmentation.
 *
 * Includes known failure segment analysis for common failure modes.
 *
 * All computations are deterministic.
 */

import { calculateBrierScore, type BrierScoreInput } from "./brierScore.js";
import { calculateLogLoss, type LogLossInput } from "./logLoss.js";
import { calculateECE, type ECEInput } from "./ece.js";
import {
  computeReliabilityCurve,
  type ReliabilityCurveInput,
  type ReliabilityCurveResult,
} from "./reliabilityCurve.js";
import { calculateCalibration, type CalibrationInput, type CalibrationResult } from "./calibration.js";
import type { MatchOutcome } from "../models/dixonColes.js";

// ── Input Types ──────────────────────────────────────────────────────────────

export interface LeaguePredictionRecord {
  /** League identifier (e.g. "Premier League", "La Liga"). */
  league: string;
  /** Predicted home win probability (0-100). */
  homeWin: number;
  /** Predicted draw probability (0-100). */
  draw: number;
  /** Predicted away win probability (0-100). */
  awayWin: number;
  /** Actual match outcome. */
  actualOutcome: MatchOutcome;
  /** Optional: match-level metadata for failure segment analysis. */
  matchId?: string;
}

// ── Output Types ─────────────────────────────────────────────────────────────

export interface OutcomeClassMetrics {
  /** Outcome class label. */
  outcome: "homeWin" | "draw" | "awayWin";
  /** Number of predictions where this was the predicted most-likely outcome. */
  predictedCount: number;
  /** Number of times this outcome actually occurred (across all predictions). */
  actualCount: number;
  /** Average predicted probability for this outcome across all predictions. */
  averagePredictedProbability: number;
  /** Observed frequency of this outcome. */
  observedFrequency: number;
  /** ECE computed using binary predictions for this outcome class. */
  ece: number;
  /** Number of samples for this outcome class. */
  sampleSize: number;
}

export interface FavoriteUnderdogMetrics {
  /** Subset label. */
  subset: "favorite" | "underdog";
  /** Number of predictions in this subset. */
  count: number;
  /** Average predicted probability of the predicted outcome. */
  averagePredictedProbability: number;
  /** Observed accuracy (how often the predicted outcome was correct). */
  accuracy: number;
  /** Brier score for this subset. */
  brierScore: number;
}

export interface FailureSegmentMetrics {
  /** Segment identifier. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Number of predictions in this segment. */
  count: number;
  /** Average absolute calibration gap. */
  averageGap: number;
  /** Severity level. */
  severity: "warning" | "critical";
}

export interface LeagueCalibrationReport {
  /** League identifier. */
  league: string;
  /** Total number of predictions evaluated. */
  sampleSize: number;
  /** Multiclass Brier score. */
  brierScore: number;
  /** Log loss. */
  logLoss: number;
  /** Expected Calibration Error. */
  ece: number;
  /** Full calibration result with buckets. */
  calibration: CalibrationResult;
  /** Reliability curve with favorite/underdog split and ECE breakdown. */
  reliabilityCurve: ReliabilityCurveResult;
  /** ECE computed from the reliability curve (weighted average of bucket gaps). */
  reliabilityEce: number;
  /** Per-outcome-class metrics. */
  outcomeClassMetrics: OutcomeClassMetrics[];
  /** Favorite vs underdog breakdown. */
  favoriteUnderdogMetrics: FavoriteUnderdogMetrics[];
  /** Known failure segments. */
  failureSegments: FailureSegmentMetrics[];
  /** Confidence level based on sample size. */
  confidence: "low" | "medium" | "high";
}

// ── Failure Segment Definitions ──────────────────────────────────────────────

const FAILURE_SEGMENTS = [
  {
    id: "low-confidence",
    description: "Matches where no outcome exceeds 45% (ambiguous predictions)",
    severity: "warning" as const,
    filter: (p: LeaguePredictionRecord) =>
      Math.max(p.homeWin, p.draw, p.awayWin) < 45,
  },
  {
    id: "draw-heavy",
    description: "Matches where draw probability exceeds 30%",
    severity: "warning" as const,
    filter: (p: LeaguePredictionRecord) => p.draw > 30,
  },
  {
    id: "extreme-favorite",
    description: "Matches where one outcome exceeds 70% (overconfident region)",
    severity: "critical" as const,
    filter: (p: LeaguePredictionRecord) =>
      Math.max(p.homeWin, p.draw, p.awayWin) > 70,
  },
  {
    id: "away-heavy-underdog",
    description: "Matches where away team predicted to win with > 50%",
    severity: "warning" as const,
    filter: (p: LeaguePredictionRecord) => p.awayWin > 50,
  },
];

// ── Internal Helpers ─────────────────────────────────────────────────────────

function buildOutcomeClassMetrics(
  predictions: LeaguePredictionRecord[],
): OutcomeClassMetrics[] {
  const outcomes: MatchOutcome[] = ["homeWin", "draw", "awayWin"];

  return outcomes.map((outcome) => {
    const allPredictedProbs = predictions.map((p) => p[outcome]);
    const averagePredictedProbability =
      allPredictedProbs.reduce((sum, v) => sum + v, 0) / predictions.length;
    const actualCount = predictions.filter((p) => p.actualOutcome === outcome).length;
    const observedFrequency = (actualCount / predictions.length) * 100;

    // ECE for this binary outcome class
    const eceInputs: ECEInput[] = predictions.map((p) => ({
      predictedProbability: p[outcome],
      actual: p.actualOutcome === outcome,
    }));
    const eceResult = calculateECE(eceInputs, 10);

    // Count where this outcome was the most likely prediction
    const predictedCount = predictions.filter((p) => {
      const maxProb = Math.max(p.homeWin, p.draw, p.awayWin);
      return p[outcome] === maxProb;
    }).length;

    return {
      outcome,
      predictedCount,
      actualCount,
      averagePredictedProbability,
      observedFrequency,
      ece: eceResult.ece,
      sampleSize: predictions.length,
    };
  });
}

function buildFavoriteUnderdogMetrics(
  predictions: LeaguePredictionRecord[],
): FavoriteUnderdogMetrics[] {
  const results: FavoriteUnderdogMetrics[] = [];

  for (const subset of ["favorite", "underdog"] as const) {
    const filtered =
      subset === "favorite"
        ? predictions.filter((p) => Math.max(p.homeWin, p.draw, p.awayWin) >= 50)
        : predictions.filter((p) => Math.max(p.homeWin, p.draw, p.awayWin) < 50);

    if (filtered.length === 0) {
      results.push({
        subset,
        count: 0,
        averagePredictedProbability: 0,
        accuracy: 0,
        brierScore: 0,
      });
      continue;
    }

    const correctCount = filtered.filter((p) => {
      const maxProb = Math.max(p.homeWin, p.draw, p.awayWin);
      return (
        (p.actualOutcome === "homeWin" && p.homeWin === maxProb) ||
        (p.actualOutcome === "draw" && p.draw === maxProb) ||
        (p.actualOutcome === "awayWin" && p.awayWin === maxProb)
      );
    }).length;

    const avgPredicted = filtered.reduce((sum, p) => {
      return sum + Math.max(p.homeWin, p.draw, p.awayWin);
    }, 0) / filtered.length;

    const brierRows: BrierScoreInput[] = filtered.map((p) => ({
      probabilities: { homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin },
      actualOutcome: p.actualOutcome,
    }));
    const brierResult = calculateBrierScore(brierRows);

    results.push({
      subset,
      count: filtered.length,
      averagePredictedProbability: avgPredicted,
      accuracy: (correctCount / filtered.length) * 100,
      brierScore: brierResult.score,
    });
  }

  return results;
}

function buildFailureSegments(
  predictions: LeaguePredictionRecord[],
): FailureSegmentMetrics[] {
  return FAILURE_SEGMENTS.map((segment) => {
    const members = predictions.filter(segment.filter);

    if (members.length === 0) {
      return {
        id: segment.id,
        description: segment.description,
        count: 0,
        averageGap: 0,
        severity: segment.severity,
      };
    }

    const gaps = members.map((p) => {
      const predictedMax = Math.max(p.homeWin, p.draw, p.awayWin);
      const predictedOutcome: MatchOutcome =
        p.homeWin === predictedMax ? "homeWin" :
        p.draw === predictedMax ? "draw" : "awayWin";
      const predictedForActual = p[p.actualOutcome];
      return Math.abs(predictedForActual - (p.actualOutcome === predictedOutcome ? 100 : 0));
    });

    const averageGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;

    return {
      id: segment.id,
      description: segment.description,
      count: members.length,
      averageGap,
      severity: segment.severity,
    };
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a per-league calibration report.
 *
 * Computes Brier score, log loss, ECE, reliability curve with favorite/underdog
 * split, per-outcome-class metrics, and failure segment analysis for each league.
 *
 * @param predictions - Array of prediction records with league identifiers
 * @param numBins - Number of bins for calibration/reliability (default: 10)
 * @returns Array of per-league calibration reports
 */
export function generateLeagueReports(
  predictions: LeaguePredictionRecord[],
  numBins = 10,
): LeagueCalibrationReport[] {
  if (predictions.length === 0) return [];

  // Group predictions by league
  const leagueMap = new Map<string, LeaguePredictionRecord[]>();
  for (const prediction of predictions) {
    const existing = leagueMap.get(prediction.league);
    if (existing) {
      existing.push(prediction);
    } else {
      leagueMap.set(prediction.league, [prediction]);
    }
  }

  const reports: LeagueCalibrationReport[] = [];

  for (const [league, leaguePredictions] of leagueMap) {
    // Brier score
    const brierRows: BrierScoreInput[] = leaguePredictions.map((p) => ({
      probabilities: { homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin },
      actualOutcome: p.actualOutcome,
    }));
    const brierResult = calculateBrierScore(brierRows);

    // Log loss
    const logLossRows: LogLossInput[] = leaguePredictions.map((p) => ({
      probabilities: { homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin },
      actualOutcome: p.actualOutcome,
    }));
    const logLossResult = calculateLogLoss(logLossRows);

    // Calibration
    const calibrationRows: CalibrationInput[] = leaguePredictions.map((p) => ({
      predictedProbability: p[p.actualOutcome],
      actual: true,
    }));
    const calibrationResult = calculateCalibration(calibrationRows, numBins);

    // ECE
    const eceInputs: ECEInput[] = leaguePredictions.map((p) => ({
      predictedProbability: p[p.actualOutcome],
      actual: true,
    }));
    const eceResult = calculateECE(eceInputs, numBins);

    // Reliability curve
    const reliabilityInputs: ReliabilityCurveInput[] = leaguePredictions.map((p) => ({
      predictedProbability: p[p.actualOutcome],
      actual: true,
    }));
    const reliabilityResult = computeReliabilityCurve(reliabilityInputs, numBins);

    // Outcome class metrics
    const outcomeClassMetrics = buildOutcomeClassMetrics(leaguePredictions);

    // Favorite/underdog metrics
    const favoriteUnderdogMetrics = buildFavoriteUnderdogMetrics(leaguePredictions);

    // Failure segments
    const failureSegments = buildFailureSegments(leaguePredictions);

    reports.push({
      league,
      sampleSize: leaguePredictions.length,
      brierScore: brierResult.score,
      logLoss: logLossResult.score,
      ece: eceResult.ece,
      calibration: calibrationResult,
      reliabilityCurve: reliabilityResult,
      reliabilityEce: reliabilityResult.ece,
      outcomeClassMetrics,
      favoriteUnderdogMetrics,
      failureSegments,
      confidence:
        leaguePredictions.length >= 200
          ? "high"
          : leaguePredictions.length >= 50
            ? "medium"
            : "low",
    });
  }

  // Sort by league name for determinism
  reports.sort((a, b) => a.league.localeCompare(b.league));
  return reports;
}
