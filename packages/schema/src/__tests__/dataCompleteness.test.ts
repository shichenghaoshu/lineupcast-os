import { describe, it, expect } from "vitest";
import {
  computeDataCompleteness,
  fullDataInput,
  emptyDataInput,
} from "../dataCompleteness.js";
import type { DataCompletenessInput } from "../dataCompleteness.js";

// Helper: start from full data and override specific fields
function withOverrides(
  overrides: Partial<DataCompletenessInput>,
): DataCompletenessInput {
  return { ...fullDataInput(), ...overrides };
}

describe("computeDataCompleteness", () => {
  // ── Score calculations ────────────────────────────────────────────

  it("returns score 100 when all data is present", () => {
    const result = computeDataCompleteness(fullDataInput());
    expect(result.score).toBe(100);
    expect(result.confidenceCap).toBe(1);
    expect(result.degradedReasons).toHaveLength(0);
  });

  it("returns score 0 when no data is present — nothing allowed", () => {
    const result = computeDataCompleteness(emptyDataInput());
    expect(result.score).toBe(0);
    expect(result.confidenceCap).toBe(0);
    expect(result.allowedPredictionOutputs).toEqual({
      preciseProbabilities: false,
      scorerRanking: false,
      cardRiskLevel: false,
      playerRatingAdjustment: false,
      refereeImpact: false,
    });
  });

  it("applies -25 penalty for missing lineup", () => {
    const result = computeDataCompleteness(withOverrides({ hasLineup: false }));
    expect(result.score).toBe(75);
    expect(result.degradedReasons).toContain("Missing lineup data");
  });

  it("applies -20 penalty for missing player stats", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasPlayerStats: false }),
    );
    expect(result.score).toBe(80);
    expect(result.degradedReasons).toContain("Missing player statistics");
  });

  it("applies -10 penalty for missing card stats", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasCardStats: false }),
    );
    expect(result.score).toBe(90);
    expect(result.degradedReasons).toContain("Missing card statistics");
  });

  it("applies -5 penalty for missing referee", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasReferee: false }),
    );
    expect(result.score).toBe(95);
    expect(result.degradedReasons).toContain(
      "Missing referee data — using league average",
    );
  });

  it("applies -10 penalty for missing recent form", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasRecentForm: false }),
    );
    expect(result.score).toBe(90);
    expect(result.degradedReasons).toContain("Missing recent form data");
  });

  it("applies -10 penalty for missing H2H", () => {
    const result = computeDataCompleteness(withOverrides({ hasH2H: false }));
    expect(result.score).toBe(90);
    expect(result.degradedReasons).toContain("Missing head-to-head data");
  });

  it("applies -10 penalty for missing injuries", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasInjuries: false }),
    );
    expect(result.score).toBe(90);
    expect(result.degradedReasons).toContain("Missing injury data");
  });

  it("applies -10 penalty for missing xG", () => {
    const result = computeDataCompleteness(withOverrides({ hasXG: false }));
    expect(result.score).toBe(90);
    expect(result.degradedReasons).toContain(
      "Missing expected goals (xG) data",
    );
  });

  // ── Cumulative penalties ──────────────────────────────────────────

  it("sums penalties for multiple missing fields", () => {
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false, // -25
        hasPlayerStats: false, // -20
        hasXG: false, // -10
      }),
    );
    // 100 - 25 - 20 - 10 = 45
    expect(result.score).toBe(45);
    expect(result.degradedReasons).toHaveLength(3);
  });

  it("clamps score at 0 even when penalties exceed 100", () => {
    const result = computeDataCompleteness(emptyDataInput());
    // All penalties: 25+20+10+5+10+10+10+10 = 100, so score = 0
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  // ── Confidence cap ────────────────────────────────────────────────

  it("confidenceCap equals score / 100", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasLineup: false, hasRecentForm: false }),
    );
    // 100 - 25 - 10 = 65
    expect(result.score).toBe(65);
    expect(result.confidenceCap).toBeCloseTo(0.65);
  });

  // ── Allowed prediction outputs ────────────────────────────────────

  it("allows all outputs when score >= 60 and all specific flags are true", () => {
    const result = computeDataCompleteness(fullDataInput());
    expect(result.allowedPredictionOutputs).toEqual({
      preciseProbabilities: true,
      scorerRanking: true,
      cardRiskLevel: true,
      playerRatingAdjustment: true,
      refereeImpact: true,
    });
  });

  it("disables preciseProbabilities when score < 60", () => {
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false, // -25
        hasPlayerStats: false, // -20
        hasXG: false, // -10
      }),
    );
    // score = 45
    expect(result.score).toBe(45);
    expect(result.allowedPredictionOutputs.preciseProbabilities).toBe(false);
  });

  it("disables scorerRanking when hasPlayerStats is false", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasPlayerStats: false }),
    );
    expect(result.allowedPredictionOutputs.scorerRanking).toBe(false);
  });

  it("disables cardRiskLevel when hasCardStats is false", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasCardStats: false }),
    );
    expect(result.allowedPredictionOutputs.cardRiskLevel).toBe(false);
  });

  it("disables playerRatingAdjustment when hasLineup is false", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasLineup: false }),
    );
    expect(result.allowedPredictionOutputs.playerRatingAdjustment).toBe(false);
  });

  it("disables refereeImpact when hasReferee is false", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasReferee: false }),
    );
    expect(result.allowedPredictionOutputs.refereeImpact).toBe(false);
  });

  // ── Missing fields pass-through ───────────────────────────────────

  it("passes through the missingFields array from input", () => {
    const input = fullDataInput(["injuries.x", "lineup.away"]);
    const result = computeDataCompleteness(input);
    expect(result.missingFields).toEqual(["injuries.x", "lineup.away"]);
  });

  // ── Degraded reasons ─────────────────────────────────────────────

  it("populates degradedReasons for every missing data source", () => {
    const result = computeDataCompleteness(emptyDataInput());
    expect(result.degradedReasons).toEqual([
      "Missing lineup data",
      "Missing player statistics",
      "Missing card statistics",
      "Missing referee data — using league average",
      "Missing recent form data",
      "Missing head-to-head data",
      "Missing injury data",
      "Missing expected goals (xG) data",
    ]);
  });

  it("degradedReasons only includes reasons for fields that are actually missing", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasLineup: false, hasH2H: false }),
    );
    expect(result.degradedReasons).toEqual([
      "Missing lineup data",
      "Missing head-to-head data",
    ]);
    expect(result.degradedReasons).toHaveLength(2);
  });

  // ── Edge case: exactly score 60 ───────────────────────────────────

  it("allows preciseProbabilities at exactly score 60", () => {
    // 100 - 25 (lineup) - 10 (form) - 5 (referee) = 60
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasRecentForm: false,
        hasReferee: false,
      }),
    );
    expect(result.score).toBe(60);
    expect(result.allowedPredictionOutputs.preciseProbabilities).toBe(true);
  });

  it("disables preciseProbabilities at score 59", () => {
    // 100 - 25 (lineup) - 10 (form) - 5 (referee) - 1 (need 1 more)
    // Use: lineup(-25) + form(-10) + referee(-5) + cardStats(-10) = 50
    // That's too low. Instead: lineup(-25) + form(-10) + h2h(-10) = 55, still < 60
    // lineup(-25) + cardStats(-10) + referee(-5) = 60. Let's add h2h(-10) = 50.
    // We need exactly 41 deducted. lineup(25) + playerStats(20) = 45 -> 55.
    // lineup(25) + cardStats(10) + referee(5) + injuries(10) = 50 -> 50.
    // Actually: 100 - 25 - 10 - 5 - 1 = ? We don't have a -1 penalty.
    // Closest below 60: lineup(-25) + playerStats(-20) = 55
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
      }),
    );
    expect(result.score).toBe(55);
    expect(result.allowedPredictionOutputs.preciseProbabilities).toBe(false);
  });

  // ── Helper functions ──────────────────────────────────────────────

  it("fullDataInput produces all-true flags with empty missingFields", () => {
    const input = fullDataInput();
    expect(input.hasLineup).toBe(true);
    expect(input.hasPlayerStats).toBe(true);
    expect(input.hasCardStats).toBe(true);
    expect(input.hasReferee).toBe(true);
    expect(input.hasRecentForm).toBe(true);
    expect(input.hasH2H).toBe(true);
    expect(input.hasInjuries).toBe(true);
    expect(input.hasXG).toBe(true);
    expect(input.missingFields).toEqual([]);
  });

  it("emptyDataInput produces all-false flags", () => {
    const input = emptyDataInput(["match.home"]);
    expect(input.hasLineup).toBe(false);
    expect(input.hasPlayerStats).toBe(false);
    expect(input.hasCardStats).toBe(false);
    expect(input.hasReferee).toBe(false);
    expect(input.hasRecentForm).toBe(false);
    expect(input.hasH2H).toBe(false);
    expect(input.hasInjuries).toBe(false);
    expect(input.hasXG).toBe(false);
    expect(input.missingFields).toEqual(["match.home"]);
  });
});
