export interface CalibrationInput {
  predictedProbability: number;
  actual: boolean;
}

export interface CalibrationBucket {
  lowerBound: number;
  upperBound: number;
  count: number;
  averagePrediction: number;
  observedRate: number;
  gap: number;
}

export interface CalibrationResult {
  modelName: "calibration";
  modelVersion: "1.0.0";
  references: string[];
  explanation: string;
  evidence: {
    observations: number;
    bucketSize: number;
  };
  confidence: "low" | "medium" | "high";
  buckets: CalibrationBucket[];
  ece: number;
}

export function calculateCalibration(rows: CalibrationInput[], bucketSize = 10): CalibrationResult {
  if (rows.length === 0) throw new Error("Calibration requires at least one row");
  if (bucketSize <= 0 || bucketSize > 100) throw new Error("bucketSize must be between 1 and 100");

  const buckets: CalibrationBucket[] = [];
  for (let lowerBound = 0; lowerBound < 100; lowerBound += bucketSize) {
    const upperBound = Math.min(100, lowerBound + bucketSize);
    const members = rows.filter((row) => row.predictedProbability >= lowerBound && (upperBound === 100 ? row.predictedProbability <= upperBound : row.predictedProbability < upperBound));
    if (members.length === 0) continue;

    const averagePrediction = members.reduce((sum, row) => sum + row.predictedProbability, 0) / members.length;
    const observedRate = (members.filter((row) => row.actual).length / members.length) * 100;
    buckets.push({
      lowerBound,
      upperBound,
      count: members.length,
      averagePrediction,
      observedRate,
      gap: Math.abs(averagePrediction - observedRate),
    });
  }

  const ece = buckets.reduce((sum, bucket) => sum + (bucket.count / rows.length) * bucket.gap, 0);

  return {
    modelName: "calibration",
    modelVersion: "1.0.0",
    references: ["Guo, C. et al. (2017) On Calibration of Modern Neural Networks."],
    explanation: "Calibration buckets compare average predicted probability against observed frequency, using percentage inputs.",
    evidence: { observations: rows.length, bucketSize },
    confidence: rows.length >= 200 ? "high" : rows.length >= 50 ? "medium" : "low",
    buckets,
    ece,
  };
}
