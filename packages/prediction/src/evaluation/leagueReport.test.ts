import { describe, expect, it } from "vitest";
import { generateLeagueReports, type LeaguePredictionRecord } from "./leagueReport.js";

describe("generateLeagueReports", () => {
  const makePredictions = (count: number, league = "Premier League"): LeaguePredictionRecord[] =>
    Array.from({ length: count }, (_, i) => ({
      league,
      homeWin: 40 + (i % 30),
      draw: 25 + (i % 10),
      awayWin: 35 - (i % 15),
      actualOutcome: (["homeWin", "draw", "awayWin"] as const)[i % 3],
    }));

  it("returns empty array for empty input", () => {
    expect(generateLeagueReports([])).toEqual([]);
  });

  it("generates a report for a single league", () => {
    const predictions = makePredictions(30);
    const reports = generateLeagueReports(predictions);

    expect(reports.length).toBe(1);
    expect(reports[0].league).toBe("Premier League");
    expect(reports[0].sampleSize).toBe(30);
  });

  it("generates separate reports for multiple leagues", () => {
    const predictions = [
      ...makePredictions(20, "Premier League"),
      ...makePredictions(15, "La Liga"),
    ];
    const reports = generateLeagueReports(predictions);

    expect(reports.length).toBe(2);
    // Sorted alphabetically
    expect(reports[0].league).toBe("La Liga");
    expect(reports[1].league).toBe("Premier League");
  });

  it("includes Brier score and log loss", () => {
    const predictions = makePredictions(30);
    const reports = generateLeagueReports(predictions);

    expect(reports[0].brierScore).toBeGreaterThan(0);
    expect(reports[0].logLoss).toBeGreaterThan(0);
  });

  it("includes ECE value", () => {
    const predictions = makePredictions(30);
    const reports = generateLeagueReports(predictions);

    expect(reports[0].ece).toBeGreaterThanOrEqual(0);
  });

  it("includes calibration buckets", () => {
    const predictions = makePredictions(30);
    const reports = generateLeagueReports(predictions);

    expect(reports[0].calibration).toBeDefined();
    expect(reports[0].calibration.buckets.length).toBeGreaterThan(0);
  });

  it("includes reliability curve with favorite/underdog split", () => {
    const predictions = makePredictions(30);
    const reports = generateLeagueReports(predictions);

    const rc = reports[0].reliabilityCurve;
    expect(rc.all.length).toBeGreaterThan(0);
    expect(Array.isArray(rc.favorite)).toBe(true);
    expect(Array.isArray(rc.underdog)).toBe(true);
    expect(typeof rc.ece).toBe("number");
    expect(typeof reports[0].reliabilityEce).toBe("number");
  });

  it("includes outcome class metrics for home/draw/away", () => {
    const predictions = makePredictions(30);
    const reports = generateLeagueReports(predictions);

    const outcomes = reports[0].outcomeClassMetrics;
    expect(outcomes.length).toBe(3);
    expect(outcomes.map((o) => o.outcome)).toEqual(["homeWin", "draw", "awayWin"]);

    for (const outcome of outcomes) {
      expect(outcome.sampleSize).toBe(30);
      expect(outcome.ece).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes favorite/underdog metrics", () => {
    const predictions = makePredictions(30);
    const reports = generateLeagueReports(predictions);

    const fu = reports[0].favoriteUnderdogMetrics;
    expect(fu.length).toBe(2);
    expect(fu.map((f) => f.subset)).toEqual(["favorite", "underdog"]);
  });

  it("includes failure segments", () => {
    const predictions = makePredictions(30);
    const reports = generateLeagueReports(predictions);

    const segments = reports[0].failureSegments;
    expect(segments.length).toBeGreaterThan(0);
    for (const seg of segments) {
      expect(seg).toHaveProperty("id");
      expect(seg).toHaveProperty("description");
      expect(seg).toHaveProperty("count");
      expect(seg).toHaveProperty("severity");
    }
  });

  it("is deterministic - same input produces same output", () => {
    const predictions = makePredictions(30);
    const reports1 = generateLeagueReports(predictions);
    const reports2 = generateLeagueReports(predictions);

    expect(reports1).toEqual(reports2);
  });

  it("assigns confidence based on sample size", () => {
    const small = generateLeagueReports(makePredictions(10));
    const medium = generateLeagueReports(makePredictions(50));
    const large = generateLeagueReports(makePredictions(200));

    expect(small[0].confidence).toBe("low");
    expect(medium[0].confidence).toBe("medium");
    expect(large[0].confidence).toBe("high");
  });

  it("handles predictions with matchId metadata", () => {
    const predictions: LeaguePredictionRecord[] = [
      {
        league: "Serie A",
        homeWin: 50,
        draw: 25,
        awayWin: 25,
        actualOutcome: "homeWin",
        matchId: "match-1",
      },
      {
        league: "Serie A",
        homeWin: 30,
        draw: 30,
        awayWin: 40,
        actualOutcome: "awayWin",
        matchId: "match-2",
      },
    ];
    const reports = generateLeagueReports(predictions);
    expect(reports.length).toBe(1);
    expect(reports[0].league).toBe("Serie A");
  });

  it("uses configurable numBins parameter", () => {
    const predictions = makePredictions(50);
    const reports5 = generateLeagueReports(predictions, 5);
    const reports10 = generateLeagueReports(predictions, 10);

    expect(reports5[0].calibration.buckets.length).toBeLessThanOrEqual(5);
    expect(reports10[0].calibration.buckets.length).toBeLessThanOrEqual(10);
  });
});
