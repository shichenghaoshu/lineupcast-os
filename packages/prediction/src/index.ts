// @lineupcast/prediction — paper-backed prediction lab.
// No LLM predicts. All models are deterministic, auditable algorithm layers.

export {
  buildIndependentPoissonMatrix,
  poissonPmf,
  type PoissonScoreProbability,
} from "./models/poisson.js";

export {
  timeDecayWeight,
  weightedAverage,
  type TimeDecayOptions,
} from "./models/timeDecay.js";

export {
  predictDixonColesFromHistory,
  type Confidence,
  type DixonColesHistoryInput,
  type DixonColesPrediction,
  type MatchHistoryRecord,
  type MatchOutcome,
} from "./models/dixonColes.js";

export {
  adjustLineupRatings,
  type LineupRatingAdjustmentInput,
  type LineupRatingAdjustmentResult,
  type PlayerRatingAdjustment,
  type PlayerRatingAdjustmentInput,
} from "./models/playerRatingAdjustment.js";

export {
  predictTopGoalScorers,
  type GoalScorerPlayerInput,
  type GoalScorerPrediction,
  type PlayerPosition,
  type TopGoalScorerInput,
  type TopGoalScorerPredictionResult,
} from "./models/goalScorer.js";

export {
  predictCardRisk,
  type CardRiskInput,
  type CardRiskPrediction,
  type CardRiskPosition,
  type RedCardRisk,
} from "./models/cardRisk.js";

export {
  calculateBrierScore,
  type BrierScoreInput,
  type BrierScoreResult,
  type OutcomeProbabilities,
} from "./evaluation/brierScore.js";

export {
  calculateLogLoss,
  type LogLossInput,
  type LogLossResult,
} from "./evaluation/logLoss.js";

export {
  calculateCalibration,
  type CalibrationBucket,
  type CalibrationInput,
  type CalibrationResult,
} from "./evaluation/calibration.js";

export {
  runBacktest,
  type BacktestInput,
  type BacktestPrediction,
  type BacktestResult,
} from "./evaluation/backtest.js";

// Deterministic Explanation Layer
export {
  explain,
  type ExplanationResult,
} from "./explanation.js";
