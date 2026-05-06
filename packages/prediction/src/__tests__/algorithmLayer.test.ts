import { describe, expect, it } from "vitest";
import {
  calculateBrierScore,
  calculateCalibration,
  calculateLogLoss,
  poissonPmf,
  predictCardRisk,
  predictDixonColesFromHistory,
  predictTopGoalScorers,
  runBacktest,
} from "../index.js";

const history = [
  { date: "2026-04-20", homeTeamId: "HOME", awayTeamId: "AWAY", homeGoals: 3, awayGoals: 1 },
  { date: "2026-04-13", homeTeamId: "HOME", awayTeamId: "MID", homeGoals: 2, awayGoals: 0 },
  { date: "2026-04-06", homeTeamId: "MID", awayTeamId: "HOME", homeGoals: 1, awayGoals: 2 },
  { date: "2026-03-30", homeTeamId: "AWAY", awayTeamId: "MID", homeGoals: 0, awayGoals: 1 },
  { date: "2026-03-23", homeTeamId: "AWAY", awayTeamId: "HOME", homeGoals: 1, awayGoals: 1 },
  { date: "2026-03-16", homeTeamId: "MID", awayTeamId: "AWAY", homeGoals: 2, awayGoals: 0 },
];

describe("real algorithm layer", () => {
  it("computes a valid Poisson probability mass", () => {
    expect(poissonPmf(2, 1.5)).toBeCloseTo(0.251021, 6);
    expect(poissonPmf(-1, 1.5)).toBe(0);
  });

  it("builds Dixon-Coles percentages from weighted match history", () => {
    const prediction = predictDixonColesFromHistory({
      homeTeamId: "HOME",
      awayTeamId: "AWAY",
      matchHistory: history,
      asOfDate: "2026-05-01",
      halfLifeDays: 30,
      maxGoals: 6,
    });

    expect(prediction.modelName).toBe("dixon-coles");
    expect(prediction.evidence.matchesUsed).toBe(history.length);
    expect(prediction.homeWin).toBeGreaterThan(prediction.awayWin);
    expect(prediction.expectedHomeGoals).toBeGreaterThan(prediction.expectedAwayGoals);
    expect(prediction.homeWin + prediction.draw + prediction.awayWin).toBeCloseTo(100, 4);
    expect(prediction.scoreMatrix.reduce((sum, score) => sum + score.probability, 0)).toBeCloseTo(100, 4);
    expect(prediction.explanation).toContain("time-weighted");
  });

  it("returns normalized top five xG-share scorer probabilities", () => {
    const result = predictTopGoalScorers({
      teamExpectedGoals: 2,
      players: [
        { playerId: "9", playerName: "Nine", expectedMinutes: 88, position: "FWD", recentXG: 2.1, shotsPer90: 4.2, isPenaltyTaker: true },
        { playerId: "11", playerName: "Wing", expectedMinutes: 82, position: "FWD", recentXG: 1.2, shotsPer90: 3.1, isPenaltyTaker: false },
        { playerId: "10", playerName: "Ten", expectedMinutes: 90, position: "MID", recentXG: 1.0, shotsPer90: 2.8, isPenaltyTaker: false },
        { playerId: "8", playerName: "Eight", expectedMinutes: 75, position: "MID", recentXG: 0.4, shotsPer90: 1.6, isPenaltyTaker: false },
        { playerId: "5", playerName: "Five", expectedMinutes: 90, position: "DEF", recentXG: 0.2, shotsPer90: 0.8, isPenaltyTaker: false },
        { playerId: "4", playerName: "Four", expectedMinutes: 70, position: "DEF", recentXG: 0.1, shotsPer90: 0.4, isPenaltyTaker: false },
      ],
    });

    expect(result.predictions).toHaveLength(5);
    expect(result.predictions[0]?.playerId).toBe("9");
    expect(result.predictions.reduce((sum, player) => sum + player.scorerProbability, 0)).toBeCloseTo(100, 4);
    expect(result.references.length).toBeGreaterThan(0);
    expect(result.evidence.playersConsidered).toBe(6);
  });

  it("keeps card risk auditable and red-card output categorical", () => {
    const result = predictCardRisk({
      playerId: "6",
      playerName: "Holder",
      yellowCardsPer90: 0.45,
      foulsPer90: 3.4,
      position: "MID",
      opponentDribblesPer90: 18,
      refereeCardsPerMatch: 5.2,
      matchPressure: 0.85,
      minutesExpected: 90,
    });

    expect(result.yellowCardProbability).toBeGreaterThan(50);
    expect(["low", "medium", "high"]).toContain(result.redCardRisk);
    expect(result).not.toHaveProperty("redCardProbability");
    expect(result.evidence.normalizedFeatures.referee).toBe(1);
  });

  it("calculates scoring metrics and calibration buckets", () => {
    const brier = calculateBrierScore([
      { probabilities: { homeWin: 60, draw: 25, awayWin: 15 }, actualOutcome: "homeWin" },
      { probabilities: { homeWin: 30, draw: 30, awayWin: 40 }, actualOutcome: "awayWin" },
    ]);
    const loss = calculateLogLoss([
      { probabilities: { homeWin: 60, draw: 25, awayWin: 15 }, actualOutcome: "homeWin" },
      { probabilities: { homeWin: 30, draw: 30, awayWin: 40 }, actualOutcome: "awayWin" },
    ]);
    const calibration = calculateCalibration([
      { predictedProbability: 60, actual: true },
      { predictedProbability: 65, actual: false },
      { predictedProbability: 82, actual: true },
    ]);

    expect(brier.score).toBeCloseTo(0.3925, 4);
    expect(loss.score).toBeCloseTo(0.7136, 4);
    expect(calibration.buckets.length).toBeGreaterThan(0);
    expect(calibration.ece).toBeGreaterThanOrEqual(0);
  });

  it("runs a deterministic walk-forward backtest", () => {
    const result = runBacktest({
      matches: history,
      startIndex: 4,
      halfLifeDays: 30,
      maxGoals: 5,
    });

    expect(result.predictions).toHaveLength(2);
    expect(result.metrics.brierScore.score).toBeGreaterThanOrEqual(0);
    expect(result.modelName).toBe("dixon-coles-backtest");
    expect(result.evidence.matchesEvaluated).toBe(2);
  });
});
