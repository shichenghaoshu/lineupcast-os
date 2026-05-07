/**
 * Model Card Generator
 *
 * Generates structured model cards (JSON + Markdown) from fitted parameters,
 * historical predictions, and data snapshot metadata. Follows the Mitchell et al.
 * (2019) "Model Cards for Model Reporting" framework.
 *
 * All metrics are deterministic: the same inputs always produce the same card.
 */

import { calculateBrierScore, type BrierScoreInput, type OutcomeProbabilities } from "../evaluation/brierScore.js";
import { calculateLogLoss, type LogLossInput } from "../evaluation/logLoss.js";
import { calculateCalibration, type CalibrationInput } from "../evaluation/calibration.js";
import type { MatchOutcome } from "../models/dixonColes.js";

import type {
  ModelCard,
  ModelCardOutput,
  ModelCardParams,
  ModelCardPrediction,
  CalibrationBinData,
  FailureSegment,
  FailureSegmentDefinition,
  PerformanceMetrics,
} from "./types.js";

// ── Default Failure Segment Definitions ─────────────────────────────────────

const DEFAULT_FAILURE_SEGMENTS: FailureSegmentDefinition[] = [
  {
    id: "high-xg-matches",
    description: "Matches with combined expected goals > 2.5 (high-scoring environments)",
    severity: "warning",
    filter: (p) => {
      const totalXG = (p.expectedHomeGoals ?? 1.35) + (p.expectedAwayGoals ?? 1.35);
      return totalXG > 2.5;
    },
  },
  {
    id: "low-confidence-predictions",
    description: "Predictions where no outcome exceeds 50% probability",
    severity: "warning",
    filter: (p) => Math.max(p.homeWin, p.draw, p.awayWin) < 50,
  },
  {
    id: "draw-heavy-predictions",
    description: "Matches where draw probability exceeds 30%",
    severity: "warning",
    filter: (p) => p.draw > 30,
  },
  {
    id: "extreme-underdog",
    description: "Matches where the away team is heavily favoured (>55% away win)",
    severity: "warning",
    filter: (p) => p.awayWin > 55,
  },
  {
    id: "near-certainty",
    description: "Predictions where a single outcome exceeds 80% (overconfident region)",
    severity: "critical",
    filter: (p) => Math.max(p.homeWin, p.draw, p.awayWin) > 80,
  },
];

// ── Internal Helpers ────────────────────────────────────────────────────────

function toOutcomeProbabilities(p: ModelCardPrediction): OutcomeProbabilities {
  return { homeWin: p.homeWin, draw: p.draw, awayWin: p.awayWin };
}

function toMatchOutcome(outcome: ModelCardPrediction["actualOutcome"]): MatchOutcome {
  return outcome;
}

function computePerformanceMetrics(predictions: ModelCardPrediction[]): PerformanceMetrics {
  if (predictions.length === 0) {
    return {
      sampleSize: 0,
      brierScore: NaN,
      brierScoreConfidence: "low",
      logLoss: NaN,
      logLossConfidence: "low",
      ece: NaN,
      eceConfidence: "low",
    };
  }

  const brierRows: BrierScoreInput[] = predictions.map((p) => ({
    probabilities: toOutcomeProbabilities(p),
    actualOutcome: toMatchOutcome(p.actualOutcome),
  }));
  const brierResult = calculateBrierScore(brierRows);

  const logLossRows: LogLossInput[] = predictions.map((p) => ({
    probabilities: toOutcomeProbabilities(p),
    actualOutcome: toMatchOutcome(p.actualOutcome),
  }));
  const logLossResult = calculateLogLoss(logLossRows);

  const calibrationRows: CalibrationInput[] = predictions.map((p) => ({
    predictedProbability: p[p.actualOutcome],
    actual: true,
  }));
  const calibrationResult = calculateCalibration(calibrationRows);

  return {
    sampleSize: predictions.length,
    brierScore: brierResult.score,
    brierScoreConfidence: brierResult.confidence,
    logLoss: logLossResult.score,
    logLossConfidence: logLossResult.confidence,
    ece: calibrationResult.ece,
    eceConfidence: calibrationResult.confidence,
  };
}

function computeCalibrationBins(predictions: ModelCardPrediction[]): CalibrationBinData[] {
  if (predictions.length === 0) return [];

  const calibrationRows: CalibrationInput[] = predictions.map((p) => ({
    predictedProbability: p[p.actualOutcome],
    actual: true,
  }));
  const result = calculateCalibration(calibrationRows);

  return result.buckets.map((bucket) => ({
    lowerBound: bucket.lowerBound,
    upperBound: bucket.upperBound,
    count: bucket.count,
    averagePrediction: bucket.averagePrediction,
    observedRate: bucket.observedRate,
    gap: bucket.gap,
  }));
}

function evaluateSegment(
  predictions: ModelCardPrediction[],
  definition: FailureSegmentDefinition,
): FailureSegment {
  const members = predictions.filter(definition.filter);

  let segmentBrierScore: number | undefined;
  let segmentLogLoss: number | undefined;

  if (members.length >= 5) {
    const brierRows: BrierScoreInput[] = members.map((p) => ({
      probabilities: toOutcomeProbabilities(p),
      actualOutcome: toMatchOutcome(p.actualOutcome),
    }));
    // Brier score may throw if < 1 row, but we checked >= 5
    segmentBrierScore = calculateBrierScore(brierRows).score;

    const logLossRows: LogLossInput[] = members.map((p) => ({
      probabilities: toOutcomeProbabilities(p),
      actualOutcome: toMatchOutcome(p.actualOutcome),
    }));
    segmentLogLoss = calculateLogLoss(logLossRows).score;
  }

  return {
    id: definition.id,
    description: definition.description,
    severity: definition.severity,
    sampleSize: members.length,
    segmentBrierScore,
    segmentLogLoss,
  };
}

function computeFailureSegments(
  predictions: ModelCardPrediction[],
  definitions: FailureSegmentDefinition[],
): FailureSegment[] {
  return definitions.map((def) => evaluateSegment(predictions, def));
}

// ── Markdown Renderer ───────────────────────────────────────────────────────

function renderMarkdown(card: ModelCard): string {
  const lines: string[] = [];

  lines.push(`# Model Card: ${card.model.name}`);
  lines.push("");
  lines.push("> Based on [Model Cards for Model Reporting (Mitchell et al., 2019)](https://arxiv.org/abs/1810.03993)");
  lines.push("");
  lines.push(`> Generated: ${card.generatedAt}`);
  lines.push(`> Schema version: ${card.schemaVersion}`);
  lines.push("");

  // Model Details
  lines.push("## Model Details");
  lines.push("");
  lines.push(`- **Name:** ${card.model.name}`);
  lines.push(`- **Version:** ${card.model.version}`);
  lines.push(`- **Type:** ${card.model.type}`);
  lines.push(`- **Owner:** ${card.model.owner}`);
  lines.push(`- **License:** ${card.model.license}`);
  lines.push("");

  // References
  if (card.model.references.length > 0) {
    lines.push("## References");
    lines.push("");
    for (const ref of card.model.references) {
      lines.push(`- ${ref}`);
    }
    lines.push("");
  }

  // Intended Use
  lines.push("## Intended Use");
  lines.push("");
  for (const use of card.intendedUse) {
    lines.push(`- ${use}`);
  }
  if (card.notIntendedFor.length > 0) {
    lines.push("");
    lines.push("**Not intended for:** " + card.notIntendedFor.join("; ") + ".");
  }
  lines.push("");

  // Input Features
  lines.push("## Input Features");
  lines.push("");
  lines.push("| Feature | Description | Default |");
  lines.push("|---------|-------------|---------|");
  for (const feature of card.inputFeatures) {
    const defaultVal = feature.defaultValue !== undefined ? String(feature.defaultValue) : "\u2014";
    lines.push(`| \`${feature.name}\` | ${feature.description} | ${defaultVal} |`);
  }
  lines.push("");

  // Output
  lines.push("## Output");
  lines.push("");
  for (const output of card.outputs) {
    lines.push(`- ${output}`);
  }
  lines.push("");

  // Data Snapshot
  lines.push("## Data Snapshot");
  lines.push("");
  lines.push(`- **Provider:** ${card.dataSnapshot.provider}`);
  lines.push(`- **League:** ${card.dataSnapshot.league}`);
  lines.push(`- **Season:** ${card.dataSnapshot.season}`);
  lines.push(`- **Date range:** ${card.dataSnapshot.dateRangeStart} to ${card.dataSnapshot.dateRangeEnd}`);
  lines.push(`- **Match count:** ${card.dataSnapshot.matchCount}`);
  lines.push(`- **Snapshot created:** ${card.dataSnapshot.snapshotCreatedAt}`);
  if (card.dataSnapshot.snapshotVersion) {
    lines.push(`- **Snapshot version:** ${card.dataSnapshot.snapshotVersion}`);
  }
  lines.push("");

  // Performance Metrics
  lines.push("## Performance Metrics");
  lines.push("");
  lines.push(`Evaluated on **${card.metrics.sampleSize}** predictions from the data snapshot.`);
  lines.push("");
  lines.push("| Metric | Value | Confidence |");
  lines.push("|--------|-------|------------|");
  lines.push(`| Brier Score | ${card.metrics.brierScore.toFixed(4)} | ${card.metrics.brierScoreConfidence} |`);
  lines.push(`| Log Loss | ${card.metrics.logLoss.toFixed(4)} | ${card.metrics.logLossConfidence} |`);
  lines.push(`| Expected Calibration Error (ECE) | ${card.metrics.ece.toFixed(2)}% | ${card.metrics.eceConfidence} |`);
  lines.push("");

  // Calibration Plot Data
  lines.push("## Calibration Plot Data");
  lines.push("");
  lines.push("Predicted vs actual probabilities by bin:");
  lines.push("");
  lines.push("| Bin (%) | Count | Avg Predicted (%) | Observed (%) | Gap (%) |");
  lines.push("|---------|-------|-------------------|--------------|---------|");
  for (const bin of card.calibrationBins) {
    lines.push(
      `| ${bin.lowerBound}\u2013${bin.upperBound} | ${bin.count} | ${bin.averagePrediction.toFixed(1)} | ${bin.observedRate.toFixed(1)} | ${bin.gap.toFixed(1)} |`
    );
  }
  lines.push("");

  // Known Failure Segments
  lines.push("## Known Failure Segments");
  lines.push("");
  if (card.failureSegments.length === 0) {
    lines.push("No failure segments defined.");
  } else {
    lines.push("| Segment | Description | Severity | Sample Size | Segment Brier | Segment Log Loss |");
    lines.push("|---------|-------------|----------|-------------|---------------|------------------|");
    for (const seg of card.failureSegments) {
      const brier = seg.segmentBrierScore !== undefined ? seg.segmentBrierScore.toFixed(4) : "N/A";
      const ll = seg.segmentLogLoss !== undefined ? seg.segmentLogLoss.toFixed(4) : "N/A";
      lines.push(
        `| ${seg.id} | ${seg.description} | ${seg.severity} | ${seg.sampleSize} | ${brier} | ${ll} |`
      );
    }
  }
  lines.push("");

  // Limitations
  lines.push("## Limitations");
  lines.push("");
  for (const limit of card.limitations) {
    lines.push(`- ${limit}`);
  }
  lines.push("");

  // Caveats
  if (card.caveats.length > 0) {
    lines.push("## Caveats");
    lines.push("");
    for (const caveat of card.caveats) {
      lines.push(`- ${caveat}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a structured model card (JSON + Markdown) from historical
 * predictions and data snapshot metadata.
 *
 * @param params - Model card generation parameters
 * @returns ModelCardOutput with both JSON and Markdown representations
 */
export function generateModelCard(params: ModelCardParams): ModelCardOutput {
  const failureDefs = params.failureSegmentDefinitions ?? DEFAULT_FAILURE_SEGMENTS;

  const metrics = computePerformanceMetrics(params.predictions);
  const calibrationBins = computeCalibrationBins(params.predictions);
  const failureSegments = computeFailureSegments(params.predictions, failureDefs);

  const card: ModelCard = {
    generatedAt: new Date().toISOString(),
    schemaVersion: "1.0.0",

    model: params.model,
    intendedUse: params.intendedUse,
    notIntendedFor: params.notIntendedFor,
    inputFeatures: params.inputFeatures,
    outputs: params.outputs,

    metrics,
    calibrationBins,
    failureSegments,

    dataSnapshot: params.dataSnapshot,

    limitations: params.limitations,
    caveats: params.caveats ?? [],
  };

  const markdown = renderMarkdown(card);

  return { json: card, markdown };
}
