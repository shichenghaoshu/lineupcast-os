import { describe, it, expect } from "vitest";
import { predictDixonColesFromHistory, type DixonColesHistoryInput, type MatchHistoryRecord } from "../models/dixonColes.js";
import { predictDixonColes, type TeamStrength } from "../dixonColes.js";
import { predictTopGoalScorers, type GoalScorerPlayerInput } from "../models/goalScorer.js";
import { predictCardRisk, type CardRiskInput } from "../models/cardRisk.js";
import { adjustLineupRatings, type PlayerRatingAdjustmentInput, type LineupRatingAdjustmentInput } from "../models/playerRatingAdjustment.js";
import { computeReliabilityCurve, type ReliabilityCurveInput } from "../evaluation/reliabilityCurve.js";

// ─── Dixon-Coles Hardening Tests ────────────────────────────────────────

describe("Dixon-Coles probability normalization", () => {
  const baseMatches: MatchHistoryRecord[] = [
    { date: "2024-01-01", homeTeamId: "A", awayTeamId: "B", homeGoals: 2, awayGoals: 1 },
    { date: "2024-01-15", homeTeamId: "A", awayTeamId: "C", homeGoals: 1, awayGoals: 1 },
    { date: "2024-02-01", homeTeamId: "B", awayTeamId: "A", homeGoals: 0, awayGoals: 3 },
    { date: "2024-02-15", homeTeamId: "C", awayTeamId: "A", homeGoals: 2, awayGoals: 2 },
    { date: "2024-03-01", homeTeamId: "A", awayTeamId: "B", homeGoals: 1, awayGoals: 0 },
  ];

  it("outcomes should sum to ~100% (within 0.5%)", () => {
    const input: DixonColesHistoryInput = {
      homeTeamId: "A",
      awayTeamId: "B",
      matchHistory: baseMatches,
      asOfDate: "2024-03-15",
    };
    const result = predictDixonColesFromHistory(input);
    const sum = result.homeWin + result.draw + result.awayWin;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
  });

  it("scoreMatrix probabilities should sum to ~100%", () => {
    const input: DixonColesHistoryInput = {
      homeTeamId: "A",
      awayTeamId: "B",
      matchHistory: baseMatches,
      asOfDate: "2024-03-15",
    };
    const result = predictDixonColesFromHistory(input);
    const matrixSum = result.scoreMatrix.reduce((sum, score) => sum + score.probability, 0);
    expect(Math.abs(matrixSum - 100)).toBeLessThanOrEqual(1.0);
  });

  it("should throw when no matches before asOfDate", () => {
    const input: DixonColesHistoryInput = {
      homeTeamId: "A",
      awayTeamId: "B",
      matchHistory: [{ date: "2025-01-01", homeTeamId: "A", awayTeamId: "B", homeGoals: 1, awayGoals: 0 }],
      asOfDate: "2024-01-01",
    };
    expect(() => predictDixonColesFromHistory(input)).toThrow("matchHistory must contain at least one match");
  });

  it("should handle single match without crashing", () => {
    const input: DixonColesHistoryInput = {
      homeTeamId: "A",
      awayTeamId: "B",
      matchHistory: [{ date: "2024-01-01", homeTeamId: "A", awayTeamId: "B", homeGoals: 1, awayGoals: 0 }],
      asOfDate: "2024-01-15",
    };
    const result = predictDixonColesFromHistory(input);
    const sum = result.homeWin + result.draw + result.awayWin;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
    expect(result.confidence).toBe("low");
  });

  it("should include degradationFlags in evidence", () => {
    const input: DixonColesHistoryInput = {
      homeTeamId: "A",
      awayTeamId: "B",
      matchHistory: baseMatches,
      asOfDate: "2024-03-15",
    };
    const result = predictDixonColesFromHistory(input);
    expect(result.evidence.degradationFlags).toBeDefined();
    expect(typeof result.evidence.degradationFlags.lowSampleSize).toBe("boolean");
    expect(typeof result.evidence.degradationFlags.missingTeamHistory).toBe("boolean");
    expect(typeof result.evidence.degradationFlags.extremeStrengthClamped).toBe("boolean");
  });

  it("should flag lowSampleSize with few matches", () => {
    const input: DixonColesHistoryInput = {
      homeTeamId: "A",
      awayTeamId: "B",
      matchHistory: [{ date: "2024-01-01", homeTeamId: "A", awayTeamId: "B", homeGoals: 2, awayGoals: 1 }],
      asOfDate: "2024-01-15",
    };
    const result = predictDixonColesFromHistory(input);
    expect(result.evidence.degradationFlags.lowSampleSize).toBe(true);
    expect(result.confidence).toBe("low");
  });

  it("should flag missingTeamHistory when team has no matches", () => {
    const input: DixonColesHistoryInput = {
      homeTeamId: "UNKNOWN",
      awayTeamId: "B",
      matchHistory: baseMatches,
      asOfDate: "2024-03-15",
    };
    const result = predictDixonColesFromHistory(input);
    expect(result.evidence.degradationFlags.missingTeamHistory).toBe(true);
  });
});

describe("Legacy Dixon-Coles normalization", () => {
  const defaultTeam: TeamStrength = { teamId: "test", attack: 1.1, defence: 0.95 };

  it("outcomes should sum to ~100% (within 0.5%)", () => {
    const result = predictDixonColes({ homeTeam: defaultTeam, awayTeam: defaultTeam });
    const sum = (result.homeWin + result.draw + result.awayWin) * 100;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
  });

  it("scoreMatrix should sum to ~100%", () => {
    const result = predictDixonColes({ homeTeam: defaultTeam, awayTeam: defaultTeam });
    const matrixSum = result.scoreMatrix.reduce((sum, score) => sum + score.probability, 0);
    expect(Math.abs(matrixSum - 100)).toBeLessThanOrEqual(1.0);
  });

  it("should handle extreme attack values without crashing", () => {
    const extreme: TeamStrength = { teamId: "extreme", attack: 100, defence: 100 };
    const result = predictDixonColes({ homeTeam: extreme, awayTeam: defaultTeam });
    const sum = (result.homeWin + result.draw + result.awayWin) * 100;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
    expect(Number.isFinite(result.homeWin)).toBe(true);
    expect(Number.isFinite(result.draw)).toBe(true);
    expect(Number.isFinite(result.awayWin)).toBe(true);
  });

  it("should handle zero matches played", () => {
    const result = predictDixonColes({ homeTeam: defaultTeam, awayTeam: defaultTeam, matchesPlayed: 0 });
    const sum = (result.homeWin + result.draw + result.awayWin) * 100;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.5);
    expect(result.confidence).toBe("low");
  });
});

// ─── Goal Scorer Hardening Tests ────────────────────────────────────────

describe("Goal scorer probability cap", () => {
  function makePlayer(overrides: Partial<GoalScorerPlayerInput> = {}): GoalScorerPlayerInput {
    return {
      playerId: "p1",
      playerName: "Test Player",
      expectedMinutes: 90,
      position: "FWD",
      recentXG: 0.8,
      shotsPer90: 4,
      ...overrides,
    };
  }

  it("no single player should exceed 45% probability", () => {
    const result = predictTopGoalScorers({
      players: [makePlayer({ recentXG: 3.0, shotsPer90: 10 })],
      teamExpectedGoals: 5.0,
    });
    for (const pred of result.predictions) {
      expect(pred.scorerProbability).toBeLessThanOrEqual(45);
    }
  });

  it("should handle empty player list gracefully", () => {
    const result = predictTopGoalScorers({
      players: [],
      teamExpectedGoals: 2.0,
    });
    expect(result.predictions).toHaveLength(0);
    expect(result.evidence.playersConsidered).toBe(0);
  });

  it("should handle missing xG and shots with defaults", () => {
    const result = predictTopGoalScorers({
      players: [
        makePlayer({ recentXG: undefined as unknown as number, shotsPer90: undefined as unknown as number }),
        makePlayer({ playerId: "p2", playerName: "Player 2", recentXG: 0.5, shotsPer90: 3 }),
      ],
      teamExpectedGoals: 2.0,
    });
    expect(result.predictions.length).toBeGreaterThan(0);
    for (const pred of result.predictions) {
      expect(pred.scorerProbability).toBeLessThanOrEqual(45);
      expect(Number.isFinite(pred.scorerProbability)).toBe(true);
    }
  });

  it("scorer probabilities should be reasonable percentages", () => {
    const players: GoalScorerPlayerInput[] = [
      makePlayer({ playerId: "p1", playerName: "Striker", position: "FWD", recentXG: 0.9, shotsPer90: 5 }),
      makePlayer({ playerId: "p2", playerName: "Midfielder", position: "MID", recentXG: 0.3, shotsPer90: 2 }),
      makePlayer({ playerId: "p3", playerName: "Defender", position: "DEF", recentXG: 0.1, shotsPer90: 0.5 }),
      makePlayer({ playerId: "p4", playerName: "GK", position: "GK", recentXG: 0.0, shotsPer90: 0 }),
    ];
    const result = predictTopGoalScorers({ players, teamExpectedGoals: 1.5 });
    for (const pred of result.predictions) {
      expect(pred.scorerProbability).toBeGreaterThanOrEqual(0);
      expect(pred.scorerProbability).toBeLessThanOrEqual(45);
    }
  });

  it("should handle NaN inputs gracefully", () => {
    const result = predictTopGoalScorers({
      players: [makePlayer({ recentXG: NaN, shotsPer90: NaN, expectedMinutes: NaN })],
      teamExpectedGoals: 2.0,
    });
    expect(result.predictions.length).toBeGreaterThan(0);
    expect(Number.isFinite(result.predictions[0]!.scorerProbability)).toBe(true);
  });
});

// ─── Card Risk Hardening Tests ──────────────────────────────────────────

describe("Card risk categorical red card", () => {
  function makeCardInput(overrides: Partial<CardRiskInput> = {}): CardRiskInput {
    return {
      playerId: "p1",
      playerName: "Test Player",
      yellowCardsPer90: 0.3,
      foulsPer90: 2.0,
      position: "DEF",
      opponentDribblesPer90: 12,
      refereeCardsPerMatch: 4,
      matchPressure: 0.6,
      minutesExpected: 90,
      ...overrides,
    };
  }

  it("redCardRisk must always be a categorical string", () => {
    const scenarios: Partial<CardRiskInput>[] = [
      { yellowCardsPer90: 0.1, foulsPer90: 0.5, position: "GK", matchPressure: 0.1 },
      { yellowCardsPer90: 0.5, foulsPer90: 4.0, position: "DEF", matchPressure: 0.9, opponentDribblesPer90: 18 },
      { yellowCardsPer90: 0.3, foulsPer90: 2.0, position: "MID" },
      { yellowCardsPer90: 0.0, foulsPer90: 0.0, position: "FWD", matchPressure: 0.0 },
    ];
    for (const scenario of scenarios) {
      const result = predictCardRisk(makeCardInput(scenario));
      expect(["low", "medium", "high"]).toContain(result.redCardRisk);
      // Ensure no numeric probability leaks through
      expect(typeof result.redCardRisk).toBe("string");
    }
  });

  it("should have confidence based on data availability", () => {
    const result = predictCardRisk(makeCardInput());
    expect(["low", "medium", "high"]).toContain(result.confidence);
  });

  it("should have low confidence when minutes are low", () => {
    const result = predictCardRisk(makeCardInput({ minutesExpected: 20 }));
    expect(result.confidence).toBe("low");
  });

  it("should handle missing inputs with graceful defaults", () => {
    const result = predictCardRisk({
      playerId: "p1",
      playerName: "Test",
      yellowCardsPer90: undefined as unknown as number,
      foulsPer90: undefined as unknown as number,
      position: "MID",
      opponentDribblesPer90: undefined as unknown as number,
      refereeCardsPerMatch: undefined as unknown as number,
      matchPressure: undefined as unknown as number,
      minutesExpected: undefined as unknown as number,
    });
    expect(["low", "medium", "high"]).toContain(result.redCardRisk);
    expect(Number.isFinite(result.yellowCardProbability)).toBe(true);
    expect(result.yellowCardProbability).toBeGreaterThanOrEqual(0);
    expect(result.yellowCardProbability).toBeLessThanOrEqual(100);
  });

  it("yellowCardProbability should be between 0 and 100", () => {
    const extreme = predictCardRisk(makeCardInput({
      yellowCardsPer90: 10,
      foulsPer90: 20,
      opponentDribblesPer90: 50,
      refereeCardsPerMatch: 10,
      matchPressure: 1.0,
    }));
    expect(extreme.yellowCardProbability).toBeGreaterThanOrEqual(0);
    expect(extreme.yellowCardProbability).toBeLessThanOrEqual(100);
  });
});

// ─── Player Rating Adjustment Hardening Tests ───────────────────────────

describe("Player rating adjustment data completeness", () => {
  function makePlayers(count: number, overrides: Partial<PlayerRatingAdjustmentInput> = {}): PlayerRatingAdjustmentInput[] {
    return Array.from({ length: count }, (_, i) => ({
      playerId: `p${i + 1}`,
      playerName: `Player ${i + 1}`,
      baseRating: 70 + (i % 10),
      expectedMinutes: 90,
      ...overrides,
    }));
  }

  it("should include degradationFlags for each player", () => {
    const input: LineupRatingAdjustmentInput = {
      teamId: "T1",
      players: makePlayers(11),
    };
    const result = adjustLineupRatings(input);
    for (const adj of result.playerAdjustments) {
      expect(adj.degradationFlags).toBeDefined();
      expect(typeof adj.degradationFlags.missingFormRating).toBe("boolean");
      expect(typeof adj.degradationFlags.missingInjuryStatus).toBe("boolean");
      expect(typeof adj.degradationFlags.missingVenue).toBe("boolean");
      expect(typeof adj.degradationFlags.missingOpponentStrength).toBe("boolean");
    }
  });

  it("should reduce confidence when data completeness score is low", () => {
    const input: LineupRatingAdjustmentInput = {
      teamId: "T1",
      players: makePlayers(11),
      dataCompletenessScore: 30,
    };
    const result = adjustLineupRatings(input);
    expect(result.confidence).toBe("low");
  });

  it("should limit output precision when data completeness score is low", () => {
    const fullDataInput: LineupRatingAdjustmentInput = {
      teamId: "T1",
      players: makePlayers(11, {
        recentFormRating: 72,
        injuryStatus: "fit",
        isHome: true,
        opponentStrength: 0.6,
      }),
      dataCompletenessScore: 100,
    };
    const lowDataInput: LineupRatingAdjustmentInput = {
      teamId: "T1",
      players: makePlayers(11),
      dataCompletenessScore: 35,
    };
    const fullResult = adjustLineupRatings(fullDataInput);
    const lowResult = adjustLineupRatings(lowDataInput);
    // Low data completeness should produce integer ratings (less precision)
    for (const adj of lowResult.playerAdjustments) {
      expect(adj.adjustedRating).toBe(Math.round(adj.adjustedRating));
    }
    // Full data should have decimal precision
    const hasDecimals = fullResult.playerAdjustments.some(
      (adj) => adj.adjustedRating !== Math.round(adj.adjustedRating),
    );
    expect(hasDecimals).toBe(true);
  });

  it("should report dataCompletenessScore in evidence", () => {
    const input: LineupRatingAdjustmentInput = {
      teamId: "T1",
      players: makePlayers(11),
      dataCompletenessScore: 75,
    };
    const result = adjustLineupRatings(input);
    expect(result.evidence.dataCompletenessScore).toBe(75);
  });

  it("should flag missing form ratings", () => {
    const input: LineupRatingAdjustmentInput = {
      teamId: "T1",
      players: makePlayers(5),
    };
    const result = adjustLineupRatings(input);
    for (const adj of result.playerAdjustments) {
      expect(adj.degradationFlags.missingFormRating).toBe(true);
    }
  });

  it("should handle out injury status correctly", () => {
    const input: LineupRatingAdjustmentInput = {
      teamId: "T1",
      players: [{ playerId: "p1", playerName: "Injured", baseRating: 80, expectedMinutes: 0, injuryStatus: "out" }],
    };
    const result = adjustLineupRatings(input);
    expect(result.playerAdjustments[0]!.adjustedRating).toBe(0);
  });
});

// ─── Reliability Curve Tests ────────────────────────────────────────────

describe("Reliability curve", () => {
  it("should compute buckets for well-calibrated predictions", () => {
    // Perfectly calibrated: 70% predictions happen 70% of the time
    const rows: ReliabilityCurveInput[] = [];
    for (let i = 0; i < 100; i++) {
      rows.push({ predictedProbability: 70, actual: i < 70 });
    }
    const result = computeReliabilityCurve(rows);
    expect(result.all.length).toBeGreaterThan(0);
    expect(result.ece).toBeLessThan(5); // Should be close to 0
  });

  it("should split by favorite and underdog", () => {
    const rows: ReliabilityCurveInput[] = [];
    // Favorites: 80% predicted, actual 80%
    for (let i = 0; i < 50; i++) {
      rows.push({ predictedProbability: 80, actual: i < 40 });
    }
    // Underdogs: 30% predicted, actual 30%
    for (let i = 0; i < 50; i++) {
      rows.push({ predictedProbability: 30, actual: i < 15 });
    }
    const result = computeReliabilityCurve(rows);
    expect(result.favorite.length).toBeGreaterThan(0);
    expect(result.underdog.length).toBeGreaterThan(0);
    expect(result.evidence.favoriteObservations).toBe(50);
    expect(result.evidence.underdogObservations).toBe(50);
  });

  it("should throw on empty input", () => {
    expect(() => computeReliabilityCurve([])).toThrow("at least one observation");
  });

  it("should include model card metadata", () => {
    const rows: ReliabilityCurveInput[] = [
      { predictedProbability: 60, actual: true },
      { predictedProbability: 40, actual: false },
    ];
    const result = computeReliabilityCurve(rows);
    expect(result.modelName).toBe("reliability-curve");
    expect(result.modelVersion).toBe("1.0.0");
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(["low", "medium", "high"]).toContain(result.confidence);
  });

  it("should compute ECE separately for favorites and underdogs", () => {
    const rows: ReliabilityCurveInput[] = [];
    // Miscalibrated favorites
    for (let i = 0; i < 100; i++) {
      rows.push({ predictedProbability: 80, actual: i < 50 }); // 50% actual, 80% predicted
    }
    // Well-calibrated underdogs
    for (let i = 0; i < 100; i++) {
      rows.push({ predictedProbability: 30, actual: i < 30 });
    }
    const result = computeReliabilityCurve(rows);
    expect(result.favoriteEce).toBeGreaterThan(result.underdogEce);
  });
});
