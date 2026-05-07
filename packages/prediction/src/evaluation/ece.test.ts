import { describe, expect, it } from "vitest";
import { calculateECE, type ECEInput } from "./ece.js";

describe("calculateECE", () => {
  const perfectlyCalibrated: ECEInput[] = [
    // 10 predictions at 50%, 5 actually occurred (50%)
    ...Array.from({ length: 5 }, () => ({ predictedProbability: 50, actual: true as const })),
    ...Array.from({ length: 5 }, () => ({ predictedProbability: 50, actual: false as const })),
    // 10 predictions at 80%, 8 actually occurred (80%)
    ...Array.from({ length: 8 }, () => ({ predictedProbability: 80, actual: true as const })),
    ...Array.from({ length: 2 }, () => ({ predictedProbability: 80, actual: false as const })),
  ];

  it("computes ECE close to 0 for perfectly calibrated predictions", () => {
    const result = calculateECE(perfectlyCalibrated, 10);
    expect(result.ece).toBeLessThan(1.0);
    expect(result.sampleSize).toBe(20);
  });

  it("computes higher ECE for miscalibrated predictions", () => {
    // Predict 90% but only 10% actually happen
    const miscalibrated: ECEInput[] = [
      ...Array.from({ length: 1 }, () => ({ predictedProbability: 90, actual: true as const })),
      ...Array.from({ length: 9 }, () => ({ predictedProbability: 90, actual: false as const })),
    ];
    const result = calculateECE(miscalibrated, 10);
    expect(result.ece).toBeGreaterThan(50);
  });

  it("returns per-bin details with all required fields", () => {
    const result = calculateECE(perfectlyCalibrated, 5);
    expect(result.bins.length).toBeGreaterThan(0);
    for (const bin of result.bins) {
      expect(bin).toHaveProperty("lowerBound");
      expect(bin).toHaveProperty("upperBound");
      expect(bin).toHaveProperty("count");
      expect(bin).toHaveProperty("averagePrediction");
      expect(bin).toHaveProperty("observedRate");
      expect(bin).toHaveProperty("gap");
      expect(bin).toHaveProperty("weightedGap");
      expect(bin).toHaveProperty("confidenceIntervalHalfWidth");
      expect(bin.count).toBeGreaterThan(0);
    }
  });

  it("respects configurable number of bins", () => {
    const result5 = calculateECE(perfectlyCalibrated, 5);
    const result10 = calculateECE(perfectlyCalibrated, 10);
    expect(result5.totalBins).toBe(5);
    expect(result10.totalBins).toBe(10);
  });

  it("is deterministic - same input always produces same output", () => {
    const result1 = calculateECE(perfectlyCalibrated, 10);
    const result2 = calculateECE(perfectlyCalibrated, 10);
    expect(result1.ece).toBe(result2.ece);
    expect(result1.bins).toEqual(result2.bins);
  });

  it("throws on empty input", () => {
    expect(() => calculateECE([], 10)).toThrow("ECE requires at least one row");
  });

  it("throws on invalid numBins", () => {
    expect(() => calculateECE(perfectlyCalibrated, 0)).toThrow("numBins must be a positive integer");
    expect(() => calculateECE(perfectlyCalibrated, -1)).toThrow("numBins must be a positive integer");
    expect(() => calculateECE(perfectlyCalibrated, 2.5)).toThrow("numBins must be a positive integer");
  });

  it("assigns confidence based on sample size", () => {
    const small: ECEInput[] = [{ predictedProbability: 50, actual: true }];
    const medium: ECEInput[] = Array.from({ length: 50 }, () => ({
      predictedProbability: 50,
      actual: true as const,
    }));
    const large: ECEInput[] = Array.from({ length: 200 }, () => ({
      predictedProbability: 50,
      actual: true as const,
    }));

    expect(calculateECE(small).confidence).toBe("low");
    expect(calculateECE(medium).confidence).toBe("medium");
    expect(calculateECE(large).confidence).toBe("high");
  });

  it("computes correct ECE for single bin with known values", () => {
    // All in 0-10 bin: 5 predictions at 5%, 1 actual (20%)
    const rows: ECEInput[] = [
      { predictedProbability: 5, actual: true },
      { predictedProbability: 5, actual: false },
      { predictedProbability: 5, actual: false },
      { predictedProbability: 5, actual: false },
      { predictedProbability: 5, actual: false },
    ];
    const result = calculateECE(rows, 10);
    // avgPrediction = 5%, observedRate = 20%, gap = 15%
    // weightedGap = (5/5) * 15 = 15
    expect(result.ece).toBeCloseTo(15, 5);
  });

  it("handles boundary values correctly", () => {
    const rows: ECEInput[] = [
      { predictedProbability: 0, actual: false },
      { predictedProbability: 100, actual: true },
    ];
    const result = calculateECE(rows, 10);
    expect(result.ece).toBeCloseTo(0, 5);
    expect(result.populatedBins).toBe(2);
  });

  it("includes confidence intervals for each bin", () => {
    const rows: ECEInput[] = Array.from({ length: 100 }, (_, i) => ({
      predictedProbability: 50,
      actual: i < 50,
    }));
    const result = calculateECE(rows, 10);
    for (const bin of result.bins) {
      expect(bin.confidenceIntervalHalfWidth).toBeGreaterThan(0);
    }
  });
});
