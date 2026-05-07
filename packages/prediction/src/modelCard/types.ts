/**
 * Model Card types following Mitchell et al. (2019) "Model Cards for Model Reporting".
 *
 * These types define the structured data for machine-readable (JSON) and
 * human-readable (Markdown) model cards tied to data snapshots.
 */

// ── Data Snapshot Metadata ──────────────────────────────────────────────────

export interface DataSnapshotMetadata {
  /** Data provider name (e.g. "statsbomb-open-data", "football-data-co-uk") */
  provider: string;
  /** League or competition (e.g. "Premier League", "La Liga") */
  league: string;
  /** Season identifier (e.g. "2024/25") */
  season: string;
  /** ISO date of earliest match in the snapshot */
  dateRangeStart: string;
  /** ISO date of latest match in the snapshot */
  dateRangeEnd: string;
  /** Total number of matches in the snapshot */
  matchCount: number;
  /** ISO timestamp when the snapshot was created */
  snapshotCreatedAt: string;
  /** Optional snapshot version or commit hash */
  snapshotVersion?: string;
}

// ── Model Description ───────────────────────────────────────────────────────

export interface ModelDescription {
  /** Model name (e.g. "dixon-coles") */
  name: string;
  /** Semantic version (e.g. "2.0.0") */
  version: string;
  /** Model type (e.g. "Correlated Poisson model with time-weighted strength parameters") */
  type: string;
  /** Owner or maintainer */
  owner: string;
  /** License (e.g. "MIT") */
  license: string;
  /** Academic references backing the model */
  references: string[];
}

// ── Performance Metrics ─────────────────────────────────────────────────────

export interface PerformanceMetrics {
  /** Number of predictions evaluated */
  sampleSize: number;
  /** Multiclass Brier score (lower is better, 0-2 range) */
  brierScore: number;
  /** Brier score confidence level */
  brierScoreConfidence: "low" | "medium" | "high";
  /** Log loss (lower is better) */
  logLoss: number;
  /** Log loss confidence level */
  logLossConfidence: "low" | "medium" | "high";
  /** Expected Calibration Error as percentage (lower is better, 0-100) */
  ece: number;
  /** ECE confidence level */
  eceConfidence: "low" | "medium" | "high";
}

// ── Calibration Plot Data ───────────────────────────────────────────────────

export interface CalibrationBinData {
  /** Lower bound of the bin (percentage, 0-100) */
  lowerBound: number;
  /** Upper bound of the bin (percentage, 0-100) */
  upperBound: number;
  /** Number of predictions in this bin */
  count: number;
  /** Average predicted probability (percentage) */
  averagePrediction: number;
  /** Observed frequency (percentage) */
  observedRate: number;
  /** Absolute gap between predicted and observed */
  gap: number;
}

// ── Failure Segments ────────────────────────────────────────────────────────

export interface FailureSegment {
  /** Short label (e.g. "high-xg-matches") */
  id: string;
  /** Human-readable description of the failure condition */
  description: string;
  /** Severity: "warning" for known weaknesses, "critical" for reliability concerns */
  severity: "warning" | "critical";
  /** Sample size for this segment (may be 0 if not enough data) */
  sampleSize: number;
  /** Brier score for this segment, if calculable */
  segmentBrierScore?: number;
  /** Log loss for this segment, if calculable */
  segmentLogLoss?: number;
}

// ── Input Features ──────────────────────────────────────────────────────────

export interface InputFeature {
  /** Feature name (e.g. "homeTeam.attack") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Default value, if any */
  defaultValue?: string | number;
}

// ── Full Model Card ─────────────────────────────────────────────────────────

export interface ModelCard {
  /** ISO timestamp when the card was generated */
  generatedAt: string;
  /** Schema version for forward compatibility */
  schemaVersion: "1.0.0";

  model: ModelDescription;
  /** Intended use cases */
  intendedUse: string[];
  /** Explicit non-intended use cases */
  notIntendedFor: string[];
  /** Input features used by the model */
  inputFeatures: InputFeature[];
  /** Output fields produced by the model */
  outputs: string[];

  metrics: PerformanceMetrics;
  calibrationBins: CalibrationBinData[];
  failureSegments: FailureSegment[];

  dataSnapshot: DataSnapshotMetadata;

  /** Known limitations of the model */
  limitations: string[];
  /** Additional caveats */
  caveats: string[];
}

// ── Model Card Markdown ─────────────────────────────────────────────────────

export interface ModelCardOutput {
  /** Structured model card (machine-readable) */
  json: ModelCard;
  /** Human-readable Markdown model card */
  markdown: string;
}

// ── Generator Parameters ────────────────────────────────────────────────────

export interface ModelCardParams {
  /** Model description and metadata */
  model: ModelDescription;
  /** Intended use cases */
  intendedUse: string[];
  /** Explicit non-intended use cases */
  notIntendedFor: string[];
  /** Input features */
  inputFeatures: InputFeature[];
  /** Output fields */
  outputs: string[];

  /**
   * Historical predictions paired with actual outcomes.
   * Each entry must contain predicted probabilities (as percentages 0-100)
   * and the actual match outcome.
   */
  predictions: ModelCardPrediction[];

  /** Data snapshot metadata */
  dataSnapshot: DataSnapshotMetadata;

  /** Known limitations */
  limitations: string[];
  /** Additional caveats */
  caveats?: string[];

  /**
   * Optional failure segment definitions.
   * If not provided, default segments are derived from the data.
   */
  failureSegmentDefinitions?: FailureSegmentDefinition[];
}

export interface ModelCardPrediction {
  /** Predicted home win probability (0-100) */
  homeWin: number;
  /** Predicted draw probability (0-100) */
  draw: number;
  /** Predicted away win probability (0-100) */
  awayWin: number;
  /** Actual outcome */
  actualOutcome: "homeWin" | "draw" | "awayWin";
  /** Optional: predicted home expected goals (for failure segment analysis) */
  expectedHomeGoals?: number;
  /** Optional: predicted away expected goals (for failure segment analysis) */
  expectedAwayGoals?: number;
}

export interface FailureSegmentDefinition {
  /** Segment id */
  id: string;
  /** Human-readable description */
  description: string;
  /** Severity */
  severity: "warning" | "critical";
  /** Filter function: returns true if the prediction belongs to this segment */
  filter: (prediction: ModelCardPrediction) => boolean;
}
