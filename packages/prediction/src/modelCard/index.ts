/**
 * @lineupcast/prediction model card module.
 *
 * Generates structured model cards (JSON + Markdown) following the
 * Mitchell et al. (2019) "Model Cards for Model Reporting" framework.
 * All metrics are deterministic and tied to data snapshots.
 */

export { generateModelCard } from "./generateModelCard.js";

export type {
  ModelCard,
  ModelCardOutput,
  ModelCardParams,
  ModelCardPrediction,
  ModelDescription,
  DataSnapshotMetadata,
  PerformanceMetrics,
  CalibrationBinData,
  FailureSegment,
  FailureSegmentDefinition,
  InputFeature,
} from "./types.js";
