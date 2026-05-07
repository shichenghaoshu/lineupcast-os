import { describe, expect, it } from "vitest";
import { computeReliabilityCurve, type ReliabilityCurveInput } from "./reliabilityCurve.js";

describe("computeReliabilityCurve", () => {
  const makeRows = (
    probs: number[],
    actuals: boolean[],
  ): ReliabilityCurveInput[] =>
    probs.map((p, i) => ({ predictedProbability: p, actual: actuals[i] }));

  it("returns all, favorite, and underdog buckets", () => {
    const rows = makeRows(
      [30, 40, 50, 60, 70, 20, 35, 55, 65, 45],
      [false, false, true, true, true, false, false, true, true, false],
    );
    const result = computeReliabilityCurve(rows, 10);

    expect(result.all.length).toBeGreaterThan(0);
    expect(Array.isArray(result.favorite)).toBe(true);
    expect(Array.isArray(result.underdog)).toBe(true);
  });

  it("splits favorites (>=50) and underdogs (<50) correctly", () => {
    const rows = makeRows(
      [50, 60, 70, 30, 20, 40],
      [true, true, true, false, false, false],
    );
    const result = computeReliabilityCurve(rows, 10);

    // Favorites: 50, 60, 70
    const favCount = result.favorite.reduce((sum, b) => sum + b.count, 0);
    expect(favCount).toBe(3);

    // Underdogs: 30, 20, 40
    const undCount = result.underdog.reduce((sum, b) => sum + b.count, 0);
    expect(undCount).toBe(3);
  });

  it("is deterministic - same input produces same output", () => {
    const rows = makeRows(
      [50, 60, 30],
      [true, false, true],
    );
    const result1 = computeReliabilityCurve(rows, 5);
    const result2 = computeReliabilityCurve(rows, 5);

    expect(result1.all).toEqual(result2.all);
    expect(result1.favorite).toEqual(result2.favorite);
    expect(result1.underdog).toEqual(result2.underdog);
    expect(result1.ece).toBe(result2.ece);
  });

  it("includes model metadata fields", () => {
    const rows = makeRows([50, 60], [true, false]);
    const result = computeReliabilityCurve(rows, 5);

    expect(result.modelName).toBe("reliability-curve");
    expect(result.modelVersion).toBe("1.0.0");
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.explanation).toBeTruthy();
    expect(result.evidence.observations).toBe(2);
    expect(result.confidence).toBe("low");
  });

  it("includes gap in each bucket", () => {
    const rows = makeRows([50, 50, 50], [true, true, false]);
    const result = computeReliabilityCurve(rows, 10);

    for (const bucket of result.all) {
      expect(typeof bucket.gap).toBe("number");
      expect(bucket.gap).toBeGreaterThanOrEqual(0);
    }
  });

  it("computes ECE, favoriteEce, underdogEce", () => {
    const rows = makeRows(
      [30, 40, 50, 60, 70],
      [false, false, true, true, true],
    );
    const result = computeReliabilityCurve(rows, 5);

    expect(typeof result.ece).toBe("number");
    expect(typeof result.favoriteEce).toBe("number");
    expect(typeof result.underdogEce).toBe("number");
  });

  it("throws on empty input", () => {
    expect(() => computeReliabilityCurve([], 10)).toThrow(
      "Reliability curve requires at least one row",
    );
  });

  it("throws on invalid numBins", () => {
    const rows = makeRows([50], [true]);
    expect(() => computeReliabilityCurve(rows, 0)).toThrow("numBins must be a positive integer");
    expect(() => computeReliabilityCurve(rows, -1)).toThrow("numBins must be a positive integer");
  });

  it("handles all predictions in one bucket", () => {
    const rows = makeRows([50, 50, 50], [true, true, false]);
    const result = computeReliabilityCurve(rows, 10);
    // All predictions at 50% should go in the 50-60 bin
    expect(result.all.length).toBeGreaterThan(0);
  });

  it("assigns confidence based on sample size", () => {
    const small = makeRows([50], [true]);
    const medium = makeRows(
      Array.from({ length: 50 }, () => 50),
      Array.from({ length: 50 }, () => true),
    );
    const large = makeRows(
      Array.from({ length: 200 }, () => 50),
      Array.from({ length: 200 }, () => true),
    );

    expect(computeReliabilityCurve(small, 10).confidence).toBe("low");
    expect(computeReliabilityCurve(medium, 10).confidence).toBe("medium");
    expect(computeReliabilityCurve(large, 10).confidence).toBe("high");
  });
});
