import { describe, it, expect } from "vitest";
import { predictDixonColes } from "../dixonColes.js";
import { predictGoalScorer } from "../goalScorer.js";
import { predictCardRisk } from "../cardRisk.js";
import { predictPlayerRating } from "../playerRating.js";
import { explain } from "../explanation.js";

describe("Dixon-Coles", () => {
  it("produces probabilities that sum to ~1", () => {
    const result = predictDixonColes({
      homeTeam: { teamId: "h", attack: 1.2, defence: 0.9 },
      awayTeam: { teamId: "a", attack: 1.0, defence: 1.1 },
    });
    const sum = result.homeWin + result.draw + result.awayWin;
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
  });

  it("favours stronger home team", () => {
    const result = predictDixonColes({
      homeTeam: { teamId: "h", attack: 1.5, defence: 0.7 },
      awayTeam: { teamId: "a", attack: 0.8, defence: 1.3 },
    });
    expect(result.homeWin).toBeGreaterThan(result.awayWin);
    expect(result.expectedHomeGoals).toBeGreaterThan(result.expectedAwayGoals);
  });

  it("produces score matrix with all entries", () => {
    const maxGoals = 5;
    const result = predictDixonColes({
      homeTeam: { teamId: "h", attack: 1.0, defence: 1.0 },
      awayTeam: { teamId: "a", attack: 1.0, defence: 1.0 },
      maxGoals,
    });
    // (maxGoals+1)^2 entries
    expect(result.scoreMatrix).toHaveLength((maxGoals + 1) ** 2);
  });

  it("has required model metadata fields", () => {
    const result = predictDixonColes({
      homeTeam: { teamId: "h", attack: 1.0, defence: 1.0 },
      awayTeam: { teamId: "a", attack: 1.0, defence: 1.0 },
    });
    expect(result.modelName).toBe("dixon-coles");
    expect(result.modelVersion).toBe("1.0.0");
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.inputFeatures.length).toBeGreaterThan(0);
    expect(result.explanations.length).toBeGreaterThan(0);
  });

  it("equal teams produce roughly symmetric results", () => {
    const result = predictDixonColes({
      homeTeam: { teamId: "h", attack: 1.0, defence: 1.0 },
      awayTeam: { teamId: "a", attack: 1.0, defence: 1.0 },
      homeAdvantage: 1.0, // remove HFA for symmetry test
    });
    // Home win should be close to away win (rho correction introduces small asymmetry)
    expect(Math.abs(result.homeWin - result.awayWin)).toBeLessThan(0.05);
  });
});

describe("xG Share Goal Scorer", () => {
  it("returns probability between 0 and 1", () => {
    const result = predictGoalScorer({
      playerId: "p1",
      playerName: "Test Striker",
      starterMinutes: 90,
      position: "FWD",
      recentXG: 0.8,
      shotsPer90: 4.0,
      isPenaltyTaker: true,
      opponentDefenceStrength: 0.6,
      teamExpectedGoals: 1.5,
    });
    expect(result.goalProbability).toBeGreaterThanOrEqual(0);
    expect(result.goalProbability).toBeLessThanOrEqual(1);
  });

  it("gives higher probability to penalty takers", () => {
    const base = {
      playerId: "p1",
      playerName: "Player",
      starterMinutes: 90,
      position: "FWD" as const,
      recentXG: 0.5,
      shotsPer90: 3.0,
      opponentDefenceStrength: 0.5,
      teamExpectedGoals: 1.5,
    };
    const withPenalty = predictGoalScorer({ ...base, isPenaltyTaker: true });
    const withoutPenalty = predictGoalScorer({ ...base, isPenaltyTaker: false });
    expect(withPenalty.goalProbability).toBeGreaterThan(withoutPenalty.goalProbability);
  });

  it("gives lower probability to defenders than forwards", () => {
    const base = {
      playerId: "p1",
      playerName: "Player",
      starterMinutes: 90,
      recentXG: 0.3,
      shotsPer90: 1.0,
      isPenaltyTaker: false,
      opponentDefenceStrength: 0.5,
      teamExpectedGoals: 1.5,
    };
    const fwd = predictGoalScorer({ ...base, position: "FWD" });
    const def = predictGoalScorer({ ...base, position: "DEF" });
    expect(fwd.goalProbability).toBeGreaterThan(def.goalProbability);
  });

  it("has required model metadata", () => {
    const result = predictGoalScorer({
      playerId: "p1",
      playerName: "Test",
      starterMinutes: 90,
      position: "FWD",
      recentXG: 0.5,
      shotsPer90: 3.0,
      isPenaltyTaker: false,
      opponentDefenceStrength: 0.5,
      teamExpectedGoals: 1.5,
    });
    expect(result.modelName).toBe("xg-share");
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.inputFeatures.length).toBeGreaterThan(0);
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});

describe("Card Risk (xB-inspired)", () => {
  it("returns yellow probability between 0 and 1", () => {
    const result = predictCardRisk({
      playerId: "p1",
      playerName: "Test Defender",
      yellowCardsPer90: 0.3,
      foulsPer90: 2.0,
      position: "DEF",
      opponentDribbleThreat: 0.5,
      refereeCardsPerMatch: 3.5,
      matchPressure: 0.5,
      minutesExpected: 90,
    });
    expect(result.yellowCardProbability).toBeGreaterThanOrEqual(0);
    expect(result.yellowCardProbability).toBeLessThanOrEqual(1);
  });

  it("gives higher risk to defenders than forwards", () => {
    const base = {
      playerId: "p1",
      playerName: "Player",
      yellowCardsPer90: 0.2,
      foulsPer90: 1.5,
      opponentDribbleThreat: 0.5,
      refereeCardsPerMatch: 3.0,
      matchPressure: 0.5,
      minutesExpected: 90,
    };
    const def = predictCardRisk({ ...base, position: "DEF" });
    const fwd = predictCardRisk({ ...base, position: "FWD" });
    expect(def.riskScore).toBeGreaterThan(fwd.riskScore);
  });

  it("returns categorical red card risk only", () => {
    const result = predictCardRisk({
      playerId: "p1",
      playerName: "Test",
      yellowCardsPer90: 0.4,
      foulsPer90: 3.0,
      position: "DEF",
      opponentDribbleThreat: 0.7,
      refereeCardsPerMatch: 4.0,
      matchPressure: 0.8,
      minutesExpected: 90,
    });
    expect(["low", "medium", "high"]).toContain(result.redCardRisk);
    // Should NOT have a precise red card percentage in the output
    expect(result).not.toHaveProperty("redCardProbability");
  });

  it("has required model metadata", () => {
    const result = predictCardRisk({
      playerId: "p1",
      playerName: "Test",
      yellowCardsPer90: 0.2,
      foulsPer90: 1.5,
      position: "MID",
      opponentDribbleThreat: 0.5,
      refereeCardsPerMatch: 3.0,
      matchPressure: 0.3,
      minutesExpected: 90,
    });
    expect(result.modelName).toBe("xb-inspired-card-risk");
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.inputFeatures.length).toBeGreaterThan(0);
  });
});

describe("Player Rating Adjustment", () => {
  it("adjusts rating within bounds", () => {
    const result = predictPlayerRating({
      playerId: "p1",
      playerName: "Test",
      baselineRating: 75,
      recentForm: 80,
      minutesLast30Days: 270,
      age: 27,
      daysSinceLastMatch: 4,
      isHome: true,
      opponentStrength: 0.5,
    });
    expect(result.adjustedRating).toBeGreaterThanOrEqual(0);
    expect(result.adjustedRating).toBeLessThanOrEqual(100);
    expect(result.adjustment).not.toBe(0);
  });

  it("penalises old players slightly", () => {
    const base = {
      playerId: "p1",
      playerName: "Player",
      baselineRating: 75,
      recentForm: 75,
      minutesLast30Days: 270,
      daysSinceLastMatch: 4,
      isHome: true,
      opponentStrength: 0.5,
    };
    const young = predictPlayerRating({ ...base, age: 25 });
    const veteran = predictPlayerRating({ ...base, age: 35 });
    expect(young.adjustedRating).toBeGreaterThan(veteran.adjustedRating);
  });

  it("has required model metadata", () => {
    const result = predictPlayerRating({
      playerId: "p1",
      playerName: "Test",
      baselineRating: 75,
      recentForm: 75,
      minutesLast30Days: 200,
      age: 28,
      daysSinceLastMatch: 5,
      isHome: false,
      opponentStrength: 0.5,
    });
    expect(result.modelName).toBe("player-rating-adjustment");
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.inputFeatures.length).toBeGreaterThan(0);
  });
});

describe("Explanation Layer", () => {
  it("generates explanation for dixon-coles output", () => {
    const prediction = predictDixonColes({
      homeTeam: { teamId: "h", attack: 1.2, defence: 0.9 },
      awayTeam: { teamId: "a", attack: 1.0, defence: 1.1 },
    });
    const result = explain(prediction);
    expect(result.modelCard).toContain("dixon-coles");
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.featureImportance.length).toBeGreaterThan(0);
    expect(result.limitations.length).toBeGreaterThan(0);
    expect(result.references.length).toBeGreaterThan(0);
  });

  it("generates explanation for goal scorer output", () => {
    const prediction = predictGoalScorer({
      playerId: "p1",
      playerName: "Test",
      starterMinutes: 90,
      position: "FWD",
      recentXG: 0.5,
      shotsPer90: 3.0,
      isPenaltyTaker: false,
      opponentDefenceStrength: 0.5,
      teamExpectedGoals: 1.5,
    });
    const result = explain(prediction);
    expect(result.modelCard).toContain("xg-share");
    expect(result.summary).toContain("xG Share score");
  });
});
