// @lineupcast/schema — data completeness scoring for match predictions

export interface DataCompletenessInput {
  hasLineup: boolean;
  hasPlayerStats: boolean;
  hasCardStats: boolean;
  hasReferee: boolean;
  hasRecentForm: boolean;
  hasH2H: boolean;
  hasInjuries: boolean;
  hasXG: boolean;
  missingFields: string[];
}

export interface DataCompletenessResult {
  score: number; // 0-100
  missingFields: string[];
  degradedReasons: string[];
  confidenceCap: number; // 0-1, max confidence allowed
  allowedPredictionOutputs: {
    preciseProbabilities: boolean; // score >= 60
    scorerRanking: boolean; // hasPlayerStats
    cardRiskLevel: boolean; // hasCardStats
    playerRatingAdjustment: boolean; // hasLineup
    refereeImpact: boolean; // hasReferee
  };
}

interface Penalty {
  field: keyof Pick<
    DataCompletenessInput,
    | "hasLineup"
    | "hasPlayerStats"
    | "hasCardStats"
    | "hasReferee"
    | "hasRecentForm"
    | "hasH2H"
    | "hasInjuries"
    | "hasXG"
  >;
  penalty: number;
  degradedReason: string;
}

const PENALTIES: Penalty[] = [
  { field: "hasLineup", penalty: 25, degradedReason: "Missing lineup data" },
  { field: "hasPlayerStats", penalty: 20, degradedReason: "Missing player statistics" },
  { field: "hasCardStats", penalty: 10, degradedReason: "Missing card statistics" },
  { field: "hasReferee", penalty: 5, degradedReason: "Missing referee data — using league average" },
  { field: "hasRecentForm", penalty: 10, degradedReason: "Missing recent form data" },
  { field: "hasH2H", penalty: 10, degradedReason: "Missing head-to-head data" },
  { field: "hasInjuries", penalty: 10, degradedReason: "Missing injury data" },
  { field: "hasXG", penalty: 10, degradedReason: "Missing expected goals (xG) data" },
];

/**
 * Evaluate how much data is available for a match prediction.
 *
 * Scoring starts at 100 and subtracts penalties for each missing data source.
 * The resulting score drives the confidence cap and determines which prediction
 * outputs are safe to display.
 */
export function computeDataCompleteness(
  input: DataCompletenessInput,
): DataCompletenessResult {
  let score = 100;
  const degradedReasons: string[] = [];
  const missingFields = [...input.missingFields];

  for (const { field, penalty, degradedReason } of PENALTIES) {
    if (!input[field]) {
      score -= penalty;
      degradedReasons.push(degradedReason);
    }
  }

  // Clamp score to [0, 100]
  score = Math.max(0, Math.min(100, score));

  const confidenceCap = score / 100;

  return {
    score,
    missingFields,
    degradedReasons,
    confidenceCap,
    allowedPredictionOutputs: {
      preciseProbabilities: score >= 60,
      scorerRanking: input.hasPlayerStats,
      cardRiskLevel: input.hasCardStats,
      playerRatingAdjustment: input.hasLineup,
      refereeImpact: input.hasReferee,
    },
  };
}

/** Convenience: build an input with all data present (score = 100). */
export function fullDataInput(
  missingFields: string[] = [],
): DataCompletenessInput {
  return {
    hasLineup: true,
    hasPlayerStats: true,
    hasCardStats: true,
    hasReferee: true,
    hasRecentForm: true,
    hasH2H: true,
    hasInjuries: true,
    hasXG: true,
    missingFields,
  };
}

/** Convenience: build an input with no data present (score = 0). */
export function emptyDataInput(
  missingFields: string[] = [],
): DataCompletenessInput {
  return {
    hasLineup: false,
    hasPlayerStats: false,
    hasCardStats: false,
    hasReferee: false,
    hasRecentForm: false,
    hasH2H: false,
    hasInjuries: false,
    hasXG: false,
    missingFields,
  };
}
