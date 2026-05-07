/**
 * Reliability Curve computation with favorite/underdog split.
 *
 * A reliability curve plots predicted probability against observed frequency
 * for binned predictions. This module supports splitting the curve by
 * favorite (predicted probability >= 50%) and underdog (< 50%) subsets,
 * and computes Expected Calibration Error (ECE) for model card output.
 *
 * All computations are deterministic.
 *
 * Reference: DeGroot, M.H. & Fienberg, S.E. (1983) "The comparison and
 * evaluation of forecasters."
 */

export interface ReliabilityCurveInput {
  /** Predicted probability for the event (0-100, as percentage). */
  predictedProbability: number;
  /** Whether the event actually occurred. */
  actual: boolean;
}

export interface ReliabilityBucket {
  /** Lower bound of the bin (percentage, 0-100). */
  lowerBound: number;
  /** Upper bound of the bin (percentage, 0-100). */
  upperBound: number;
  /** Number of predictions in this bucket. */
  count: number;
  /** Average predicted probability (percentage). */
  averagePrediction: number;
  /** Observed frequency of outcomes (percentage). */
  observedRate: number;
  /** Absolute gap between predicted and observed. */
  gap: number;
}

export interface ReliabilityCurveResult {
  /** Model name identifier. */
  modelName: "reliability-curve";
  /** Model version. */
  modelVersion: "1.0.0";
  /** Academic references. */
  references: string[];
  /** Human-readable explanation. */
  explanation: string;
  /** Evidence metadata for model card. */
  evidence: {
    observations: number;
    bucketSize: number;
    favoriteObservations: number;
    underdogObservations: number;
  };
  /** Confidence in the reliability estimate based on sample size. */
  confidence: "low" | "medium" | "high";
  /** Full curve across all predictions. */
  all: ReliabilityBucket[];
  /** Curve for predictions where the predicted probability >= 50% (favorites). */
  favorite: ReliabilityBucket[];
  /** Curve for predictions where the predicted probability < 50% (underdogs). */
  underdog: ReliabilityBucket[];
  /** Expected Calibration Error across all predictions. */
  ece: number;
  /** ECE for favorite predictions only. */
  favoriteEce: number;
  /** ECE for underdog predictions only. */
  underdogEce: number;
}

/**
 * Compute reliability buckets for a set of predictions.
 */
function computeBuckets(
  rows: ReliabilityCurveInput[],
  numBins: number,
): ReliabilityBucket[] {
  if (rows.length === 0) return [];

  const binWidth = 100 / numBins;
  const buckets: ReliabilityBucket[] = [];

  for (let i = 0; i < numBins; i += 1) {
    const lowerBound = i * binWidth;
    const upperBound = (i + 1) * binWidth;

    const isInBin = (row: ReliabilityCurveInput): boolean => {
      if (i === numBins - 1) {
        return row.predictedProbability >= lowerBound && row.predictedProbability <= upperBound;
      }
      return row.predictedProbability >= lowerBound && row.predictedProbability < upperBound;
    };

    const members = rows.filter(isInBin);
    if (members.length === 0) continue;

    const averagePrediction =
      members.reduce((sum, row) => sum + row.predictedProbability, 0) / members.length;
    const observedRate =
      (members.filter((row) => row.actual).length / members.length) * 100;

    buckets.push({
      lowerBound,
      upperBound,
      count: members.length,
      averagePrediction,
      observedRate,
      gap: Math.abs(averagePrediction - observedRate),
    });
  }

  return buckets;
}

/**
 * Compute ECE as the weighted average of bucket gaps.
 */
function computeEce(buckets: ReliabilityBucket[], totalRows: number): number {
  if (totalRows === 0 || buckets.length === 0) return 0;
  return buckets.reduce(
    (sum, bucket) => sum + (bucket.count / totalRows) * bucket.gap,
    0,
  );
}

/**
 * Compute a reliability curve with favorite/underdog split and ECE.
 *
 * Favorites are defined as predictions where the predicted probability >= 50%.
 * Underdogs are those where predicted probability < 50%.
 *
 * Output is suitable for model card documentation (Mitchell et al., 2019).
 *
 * @param rows - Array of {predictedProbability, actual} pairs
 * @param numBins - Number of equal-width bins (default: 10)
 * @returns Reliability curve data with all, favorite, underdog buckets and ECE
 */
export function computeReliabilityCurve(
  rows: ReliabilityCurveInput[],
  numBins = 10,
): ReliabilityCurveResult {
  if (rows.length === 0) throw new Error("Reliability curve requires at least one row");
  if (numBins <= 0 || !Number.isInteger(numBins)) {
    throw new Error("numBins must be a positive integer");
  }

  const favorites = rows.filter((row) => row.predictedProbability >= 50);
  const underdogs = rows.filter((row) => row.predictedProbability < 50);

  const allBuckets = computeBuckets(rows, numBins);
  const favBuckets = computeBuckets(favorites, numBins);
  const undBuckets = computeBuckets(underdogs, numBins);

  const ece = computeEce(allBuckets, rows.length);
  const favoriteEce = computeEce(favBuckets, favorites.length);
  const underdogEce = computeEce(undBuckets, underdogs.length);

  const confidence: "low" | "medium" | "high" =
    rows.length >= 200 ? "high" : rows.length >= 50 ? "medium" : "low";

  return {
    modelName: "reliability-curve",
    modelVersion: "1.0.0",
    references: [
      "DeGroot, M.H. & Fienberg, S.E. (1983) The comparison and evaluation of forecasters.",
      "Guo, C. et al. (2017) On Calibration of Modern Neural Networks.",
      "Naeini, M.P. et al. (2015) Obtaining Well Calibrated Probabilities Using Bayesian Binning.",
    ],
    explanation: "Reliability buckets compare average predicted probability against observed frequency, with favorite/underdog split for analyzing calibration of strong vs weak predictions. ECE is the weighted average of absolute calibration gaps.",
    evidence: {
      observations: rows.length,
      bucketSize: 100 / numBins,
      favoriteObservations: favorites.length,
      underdogObservations: underdogs.length,
    },
    confidence,
    all: allBuckets,
    favorite: favBuckets,
    underdog: undBuckets,
    ece,
    favoriteEce,
    underdogEce,
  };
}
