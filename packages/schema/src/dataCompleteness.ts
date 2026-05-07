// @lineupcast/schema — data completeness scoring for match predictions
//
// Modes:
//   - full (score >= 60): all prediction outputs enabled
//   - warning (score < 60): confidence capped, some outputs disabled
//   - narrative_only (score < 40): only narrative/commentary safe
//   - no_prediction (missing fixture): no prediction possible

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PredictionMode =
  | "full"
  | "warning"
  | "narrative_only"
  | "no_prediction";

export interface DataCompletenessInput {
  hasFixture: boolean;
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
  /** Completeness score 0-100 */
  score: number;
  /** Prediction mode based on score thresholds */
  mode: PredictionMode;
  missingFields: string[];
  degradedReasons: string[];
  /** Confidence cap 0.0-1.0, max confidence allowed */
  confidenceCap: number;
  allowedPredictionOutputs: {
    /** score >= 60 */
    preciseProbabilities: boolean;
    /** hasPlayerStats */
    scorerRanking: boolean;
    /** hasCardStats */
    cardRiskLevel: boolean;
    /** hasLineup */
    playerRatingAdjustment: boolean;
    /** hasReferee */
    refereeImpact: boolean;
    /** not hasRecentForm — exact probabilities disabled */
    noExactProbability: boolean;
    /** mode === "narrative_only" */
    narrativeOnly: boolean;
    /** missing fixture — no prediction possible */
    noPrediction: boolean;
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const COMPLETENESS_WARNING_THRESHOLD = 60;
export const NARRATIVE_ONLY_THRESHOLD = 40;

const PENALTIES: Penalty[] = [
  { field: "hasLineup", penalty: 25, degradedReason: "Missing lineup data" },
  {
    field: "hasPlayerStats",
    penalty: 20,
    degradedReason: "Missing player statistics",
  },
  {
    field: "hasCardStats",
    penalty: 15,
    degradedReason: "Missing card statistics",
  },
  {
    field: "hasReferee",
    penalty: 10,
    degradedReason: "Missing referee data — using league average",
  },
  {
    field: "hasRecentForm",
    penalty: 15,
    degradedReason: "Missing recent form data",
  },
  {
    field: "hasH2H",
    penalty: 5,
    degradedReason: "Missing head-to-head data",
  },
  {
    field: "hasInjuries",
    penalty: 5,
    degradedReason: "Missing injury data",
  },
  {
    field: "hasXG",
    penalty: 5,
    degradedReason: "Missing expected goals (xG) data",
  },
];

// Tiered confidence caps (matching Python _CAPS_BY_SCORE)
const CAPS_BY_SCORE: [number, number][] = [
  [80, 1.0],
  [60, 0.85],
  [40, 0.70],
  [0, 0.50],
];

// ---------------------------------------------------------------------------
// Core scoring function
// ---------------------------------------------------------------------------

function capForScore(score: number): number {
  for (const [threshold, cap] of CAPS_BY_SCORE) {
    if (score >= threshold) return cap;
  }
  return 0.5;
}

/**
 * Evaluate how much data is available for a match prediction.
 *
 * Scoring starts at 100 and subtracts penalties for each missing data source.
 * The resulting score drives the confidence cap and determines which prediction
 * outputs are safe to display.
 *
 * Modes:
 *  - no_prediction: missing fixture (matchId / kickoff / teams)
 *  - narrative_only: score < 40
 *  - warning: score < 60
 *  - full: score >= 60
 */
export function computeDataCompleteness(
  input: DataCompletenessInput,
): DataCompletenessResult {
  // ── Fixture gate ───────────────────────────────────────────────────────
  if (!input.hasFixture) {
    return {
      score: 0,
      mode: "no_prediction",
      missingFields: [...input.missingFields, "fixture"],
      degradedReasons: ["Missing fixture data — no prediction possible"],
      confidenceCap: 0,
      allowedPredictionOutputs: {
        preciseProbabilities: false,
        scorerRanking: false,
        cardRiskLevel: false,
        playerRatingAdjustment: false,
        refereeImpact: false,
        noExactProbability: true,
        narrativeOnly: true,
        noPrediction: true,
      },
    };
  }

  // ── Score calculation ──────────────────────────────────────────────────
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

  // ── Confidence cap (tiered, matching Python) ───────────────────────────
  const confidenceCap = capForScore(score);

  // ── Mode determination ─────────────────────────────────────────────────
  let mode: PredictionMode;
  if (score < NARRATIVE_ONLY_THRESHOLD) {
    mode = "narrative_only";
  } else if (score < COMPLETENESS_WARNING_THRESHOLD) {
    mode = "warning";
  } else {
    mode = "full";
  }

  return {
    score,
    mode,
    missingFields,
    degradedReasons,
    confidenceCap,
    allowedPredictionOutputs: {
      preciseProbabilities: score >= COMPLETENESS_WARNING_THRESHOLD,
      scorerRanking: input.hasPlayerStats,
      cardRiskLevel: input.hasCardStats,
      playerRatingAdjustment: input.hasLineup,
      refereeImpact: input.hasReferee,
      noExactProbability: !input.hasRecentForm,
      narrativeOnly: mode === "narrative_only",
      noPrediction: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** Convenience: build an input with all data present (score = 100). */
export function fullDataInput(
  missingFields: string[] = [],
): DataCompletenessInput {
  return {
    hasFixture: true,
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
    hasFixture: false,
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
