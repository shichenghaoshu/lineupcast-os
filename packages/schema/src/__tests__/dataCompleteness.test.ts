import { describe, it, expect } from "vitest";
import {
  computeDataCompleteness,
  fullDataInput,
  emptyDataInput,
  COMPLETENESS_WARNING_THRESHOLD,
  NARRATIVE_ONLY_THRESHOLD,
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
    expect(result.mode).toBe("full");
    expect(result.confidenceCap).toBe(1);
    expect(result.degradedReasons).toHaveLength(0);
  });

  it("returns score 0 with no_prediction mode when fixture is missing", () => {
    const result = computeDataCompleteness(emptyDataInput());
    expect(result.score).toBe(0);
    expect(result.mode).toBe("no_prediction");
    expect(result.confidenceCap).toBe(0);
    expect(result.allowedPredictionOutputs.noPrediction).toBe(true);
    expect(result.allowedPredictionOutputs.narrativeOnly).toBe(true);
    expect(result.degradedReasons).toContain(
      "Missing fixture data — no prediction possible",
    );
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

  it("applies -15 penalty for missing card stats", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasCardStats: false }),
    );
    expect(result.score).toBe(85);
    expect(result.degradedReasons).toContain("Missing card statistics");
  });

  it("applies -10 penalty for missing referee", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasReferee: false }),
    );
    expect(result.score).toBe(90);
    expect(result.degradedReasons).toContain(
      "Missing referee data — using league average",
    );
  });

  it("applies -15 penalty for missing recent form", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasRecentForm: false }),
    );
    expect(result.score).toBe(85);
    expect(result.degradedReasons).toContain("Missing recent form data");
  });

  it("applies -5 penalty for missing H2H", () => {
    const result = computeDataCompleteness(withOverrides({ hasH2H: false }));
    expect(result.score).toBe(95);
    expect(result.degradedReasons).toContain("Missing head-to-head data");
  });

  it("applies -5 penalty for missing injuries", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasInjuries: false }),
    );
    expect(result.score).toBe(95);
    expect(result.degradedReasons).toContain("Missing injury data");
  });

  it("applies -5 penalty for missing xG", () => {
    const result = computeDataCompleteness(withOverrides({ hasXG: false }));
    expect(result.score).toBe(95);
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
        hasXG: false, // -5
      }),
    );
    // 100 - 25 - 20 - 5 = 50
    expect(result.score).toBe(50);
    expect(result.degradedReasons).toHaveLength(3);
  });

  it("clamps score at 0 even when penalties exceed 100", () => {
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
        hasCardStats: false,
        hasReferee: false,
        hasRecentForm: false,
        hasH2H: false,
        hasInjuries: false,
        hasXG: false,
      }),
    );
    expect(result.score).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  // ── Tiered confidence cap ────────────────────────────────────────

  it("uses cap 1.0 when score >= 80", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasXG: false }), // 100 - 5 = 95
    );
    expect(result.score).toBe(95);
    expect(result.confidenceCap).toBe(1.0);
  });

  it("uses cap 0.85 when score is 60-79", () => {
    // 100 - 25 (lineup) - 15 (form) = 60
    const result = computeDataCompleteness(
      withOverrides({ hasLineup: false, hasRecentForm: false }),
    );
    expect(result.score).toBe(60);
    expect(result.confidenceCap).toBe(0.85);
  });

  it("uses cap 0.70 when score is 40-59", () => {
    // 100 - 25 - 20 = 55
    const result = computeDataCompleteness(
      withOverrides({ hasLineup: false, hasPlayerStats: false }),
    );
    expect(result.score).toBe(55);
    expect(result.confidenceCap).toBe(0.7);
  });

  it("uses cap 0.50 when score < 40", () => {
    // 100 - 25 - 20 - 15 - 10 = 30
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
        hasCardStats: false,
        hasReferee: false,
      }),
    );
    expect(result.score).toBe(30);
    expect(result.confidenceCap).toBe(0.5);
  });

  // ── Mode determination ───────────────────────────────────────────

  it("returns mode 'full' when score >= 60", () => {
    const result = computeDataCompleteness(fullDataInput());
    expect(result.mode).toBe("full");
  });

  it("returns mode 'warning' when score is 40-59", () => {
    // 100 - 25 - 20 = 55
    const result = computeDataCompleteness(
      withOverrides({ hasLineup: false, hasPlayerStats: false }),
    );
    expect(result.score).toBe(55);
    expect(result.mode).toBe("warning");
  });

  it("returns mode 'narrative_only' when score < 40", () => {
    // 100 - 25 - 20 - 15 - 10 = 30
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
        hasCardStats: false,
        hasReferee: false,
      }),
    );
    expect(result.score).toBe(30);
    expect(result.mode).toBe("narrative_only");
  });

  it("returns mode 'no_prediction' when fixture is missing", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasFixture: false }),
    );
    expect(result.mode).toBe("no_prediction");
    expect(result.score).toBe(0);
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
      noExactProbability: false,
      narrativeOnly: false,
      noPrediction: false,
    });
  });

  it("disables preciseProbabilities when score < 60", () => {
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false, // -25
        hasPlayerStats: false, // -20
        hasXG: false, // -5
      }),
    );
    // score = 50
    expect(result.score).toBe(50);
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

  it("sets noExactProbability when hasRecentForm is false", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasRecentForm: false }),
    );
    expect(result.allowedPredictionOutputs.noExactProbability).toBe(true);
  });

  it("sets narrativeOnly when mode is narrative_only", () => {
    // 100 - 25 - 20 - 15 - 10 = 30
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
        hasCardStats: false,
        hasReferee: false,
      }),
    );
    expect(result.mode).toBe("narrative_only");
    expect(result.allowedPredictionOutputs.narrativeOnly).toBe(true);
  });

  it("sets noPrediction when fixture is missing", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasFixture: false }),
    );
    expect(result.allowedPredictionOutputs.noPrediction).toBe(true);
    expect(result.allowedPredictionOutputs.preciseProbabilities).toBe(false);
    expect(result.allowedPredictionOutputs.scorerRanking).toBe(false);
    expect(result.allowedPredictionOutputs.cardRiskLevel).toBe(false);
    expect(result.allowedPredictionOutputs.playerRatingAdjustment).toBe(false);
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
    // Use hasFixture: true to avoid the no_prediction early return
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
        hasCardStats: false,
        hasReferee: false,
        hasRecentForm: false,
        hasH2H: false,
        hasInjuries: false,
        hasXG: false,
      }),
    );
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

  // ── Edge case: exactly score 60 (warning threshold) ──────────────

  it("allows preciseProbabilities at exactly score 60", () => {
    // 100 - 25 (lineup) - 15 (form) = 60
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasRecentForm: false,
      }),
    );
    expect(result.score).toBe(60);
    expect(result.mode).toBe("full");
    expect(result.allowedPredictionOutputs.preciseProbabilities).toBe(true);
  });

  it("disables preciseProbabilities at score 55", () => {
    // 100 - 25 (lineup) - 20 (playerStats) = 55
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
      }),
    );
    expect(result.score).toBe(55);
    expect(result.mode).toBe("warning");
    expect(result.allowedPredictionOutputs.preciseProbabilities).toBe(false);
  });

  // ── Edge case: exactly score 40 (narrative threshold) ─────────────

  it("is mode 'warning' at exactly score 40", () => {
    // 100 - 25 - 20 - 15 - 5(h2h) = 35. Need 40.
    // 100 - 25 - 20 - 15 = 40
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
        hasCardStats: false,
      }),
    );
    expect(result.score).toBe(40);
    expect(result.mode).toBe("warning");
  });

  it("is mode 'narrative_only' at score 35", () => {
    // 100 - 25 - 20 - 15 - 5 = 35
    const result = computeDataCompleteness(
      withOverrides({
        hasLineup: false,
        hasPlayerStats: false,
        hasCardStats: false,
        hasH2H: false,
      }),
    );
    expect(result.score).toBe(35);
    expect(result.mode).toBe("narrative_only");
  });

  // ── Constants ────────────────────────────────────────────────────

  it("exports COMPLETENESS_WARNING_THRESHOLD as 60", () => {
    expect(COMPLETENESS_WARNING_THRESHOLD).toBe(60);
  });

  it("exports NARRATIVE_ONLY_THRESHOLD as 40", () => {
    expect(NARRATIVE_ONLY_THRESHOLD).toBe(40);
  });

  // ── Helper functions ──────────────────────────────────────────────

  it("fullDataInput produces all-true flags with empty missingFields", () => {
    const input = fullDataInput();
    expect(input.hasFixture).toBe(true);
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
    expect(input.hasFixture).toBe(false);
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

  // ── Fixture gate edge cases ──────────────────────────────────────

  it("returns no_prediction even when other data is present but fixture is missing", () => {
    const result = computeDataCompleteness(
      withOverrides({
        hasFixture: false,
        hasLineup: true,
        hasPlayerStats: true,
      }),
    );
    expect(result.mode).toBe("no_prediction");
    expect(result.score).toBe(0);
    expect(result.allowedPredictionOutputs.noPrediction).toBe(true);
  });

  it("includes 'fixture' in missingFields when fixture is absent", () => {
    const result = computeDataCompleteness(
      withOverrides({ hasFixture: false }),
    );
    expect(result.missingFields).toContain("fixture");
  });
});
