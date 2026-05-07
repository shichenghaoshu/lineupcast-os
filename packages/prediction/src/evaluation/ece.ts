/**
 * Expected Calibration Error (ECE) computation.
 *
 * ECE measures the average absolute difference between predicted probabilities
 * and observed frequencies across binned predictions. Lower ECE indicates
 * better calibration.
 *
 * All computations are deterministic: identical inputs always yield identical outputs.
 *
 * Reference: Guo, C. et al. (2017) "On Calibration of Modern Neural Networks."
 */

export interface ECEInput {
  /** Predicted probability for the positive class (0-100, as percentage). */
  predictedProbability: number;
  /** Whether the event actually occurred. */
  actual: boolean;
}

export interface ECEBinDetail {
  /** Lower bound of the bin (percentage, 0-100). */
  lowerBound: number;
  /** Upper bound of the bin (percentage, 0-100). */
  upperBound: number;
  /** Number of predictions in this bin. */
  count: number;
  /** Average predicted probability in this bin (percentage). */
  averagePrediction: number;
  /** Observed frequency of positive outcomes in this bin (percentage). */
  observedRate: number;
  /** Absolute gap between averagePrediction and observedRate. */
  gap: number;
  /** Weighted contribution to ECE (count/total * gap). */
  weightedGap: number;
  /** 95% confidence interval half-width for observedRate (Wilson score). */
  confidenceIntervalHalfWidth: number;
}

export interface ECEResult {
  /** Expected Calibration Error (0-100, percentage scale). */
  ece: number;
  /** Number of bins that contained predictions. */
  populatedBins: number;
  /** Total number of bins (configurable). */
  totalBins: number;
  /** Per-bin details. */
  bins: ECEBinDetail[];
  /** Total number of predictions evaluated. */
  sampleSize: number;
  /** Confidence level derived from sample size. */
  confidence: "low" | "medium" | "high";
}

/**
 * Compute the Wilson score interval half-width for a binomial proportion.
 * Used for per-bin confidence intervals on observed rates.
 *
 * @param successes - Number of positive outcomes in the bin
 * @param trials - Total predictions in the bin
 * @param z - z-score for the desired confidence level (1.96 for 95%)
 * @returns Half-width of the confidence interval
 */
function wilsonConfidenceIntervalHalfWidth(
  successes: number,
  trials: number,
  z = 1.96,
): number {
  if (trials === 0) return 0;
  const p = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const margin =
    (z * Math.sqrt((p * (1 - p) + (z * z) / (4 * trials)) / trials)) / denominator;
  // Return just the half-width from center to upper bound
  return Math.max(0, margin) * 100; // Convert to percentage scale
}

/**
 * Compute Expected Calibration Error with configurable number of bins.
 *
 * @param rows - Array of {predictedProbability, actual} pairs
 * @param numBins - Number of equal-width bins to use (default: 10)
 * @returns ECE value and per-bin details with confidence intervals
 */
export function calculateECE(rows: ECEInput[], numBins = 10): ECEResult {
  if (rows.length === 0) throw new Error("ECE requires at least one row");
  if (numBins <= 0 || !Number.isInteger(numBins)) {
    throw new Error("numBins must be a positive integer");
  }

  const binWidth = 100 / numBins;
  const bins: ECEBinDetail[] = [];

  for (let i = 0; i < numBins; i += 1) {
    const lowerBound = i * binWidth;
    const upperBound = (i + 1) * binWidth;

    const isInBin = (row: ECEInput): boolean => {
      if (i === numBins - 1) {
        // Last bin is inclusive on upper bound
        return row.predictedProbability >= lowerBound && row.predictedProbability <= upperBound;
      }
      return row.predictedProbability >= lowerBound && row.predictedProbability < upperBound;
    };

    const members = rows.filter(isInBin);
    if (members.length === 0) continue;

    const averagePrediction =
      members.reduce((sum, row) => sum + row.predictedProbability, 0) / members.length;
    const positiveCount = members.filter((row) => row.actual).length;
    const observedRate = (positiveCount / members.length) * 100;
    const gap = Math.abs(averagePrediction - observedRate);
    const weightedGap = (members.length / rows.length) * gap;

    bins.push({
      lowerBound,
      upperBound,
      count: members.length,
      averagePrediction,
      observedRate,
      gap,
      weightedGap,
      confidenceIntervalHalfWidth: wilsonConfidenceIntervalHalfWidth(
        positiveCount,
        members.length,
      ),
    });
  }

  const ece = bins.reduce((sum, bin) => sum + bin.weightedGap, 0);

  return {
    ece,
    populatedBins: bins.length,
    totalBins: numBins,
    bins,
    sampleSize: rows.length,
    confidence: rows.length >= 200 ? "high" : rows.length >= 50 ? "medium" : "low",
  };
}
