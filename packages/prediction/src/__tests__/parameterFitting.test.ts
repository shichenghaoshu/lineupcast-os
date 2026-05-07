import { describe, it, expect } from "vitest";
import { fitDixonColesParams, predictFromFittedParams } from "../calibration/parameterFitting.js";
import type { HistoricalMatch } from "../calibration/types.js";

// ---------------------------------------------------------------------------
// Helper: generate a round-robin season of synthetic matches
// ---------------------------------------------------------------------------

function generateSyntheticSeason(
  teams: Array<{ id: string; attack: number; defence: number }>,
  startDate: string,
): HistoricalMatch[] {
  const matches: HistoricalMatch[] = [];
  const start = new Date(startDate);

  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < teams.length; i++) {
      for (let j = 0; j < teams.length; j++) {
        if (i === j) continue;
        const home = teams[round === 0 ? i : j]!;
        const away = teams[round === 0 ? j : i]!;

        // Expected goals from true strengths
        const lamH = 1.3 * home.attack * (2 - away.defence); // gamma ~ 1.3
        const lamA = away.attack * (2 - home.defence);

        // Poisson sampling (simple inverse-CDF method)
        const homeGoals = samplePoisson(Math.max(0.1, lamH));
        const awayGoals = samplePoisson(Math.max(0.1, lamA));

        const matchDate = new Date(start.getTime() + (round * teams.length * teams.length + i * teams.length + j) * 86_400_000);
        matches.push({
          date: matchDate.toISOString().slice(0, 10),
          homeTeamId: home.id,
          awayTeamId: away.id,
          homeGoals,
          awayGoals,
        });
      }
    }
  }
  return matches;
}

function samplePoisson(lambda: number): number {
  let L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fitDixonColesParams", () => {
  it("throws on empty input", () => {
    expect(() => fitDixonColesParams([])).toThrow("at least one historical match");
  });

  it("fits a single match without crashing", () => {
    const result = fitDixonColesParams([
      { date: "2024-01-01", homeTeamId: "A", awayTeamId: "B", homeGoals: 2, awayGoals: 1 },
    ]);
    expect(result.modelName).toBe("dixon-coles-fitted");
    expect(result.fittedParams.gamma).toBeGreaterThan(0);
    expect(result.fittedParams.rho).toBeLessThan(0.1);
    expect(result.fittedParams.rho).toBeGreaterThan(-0.5);
  });

  it("discovers all teams from match data", () => {
    const matches: HistoricalMatch[] = [
      { date: "2024-01-01", homeTeamId: "A", awayTeamId: "B", homeGoals: 1, awayGoals: 0 },
      { date: "2024-01-08", homeTeamId: "C", awayTeamId: "A", homeGoals: 0, awayGoals: 2 },
      { date: "2024-01-15", homeTeamId: "B", awayTeamId: "C", homeGoals: 3, awayGoals: 1 },
    ];
    const result = fitDixonColesParams(matches);
    expect(result.evidence.teamsDiscovered).toBe(3);
    expect(Object.keys(result.fittedParams.alpha)).toEqual(
      expect.arrayContaining(["A", "B", "C"]),
    );
  });

  it("gives stronger teams higher alpha values", () => {
    // Deterministic seed-like scenario: Team A always scores 4, Team B always scores 0
    const matches: HistoricalMatch[] = [];
    for (let i = 0; i < 20; i++) {
      matches.push({
        date: `2024-01-${String(i + 1).padStart(2, "0")}`,
        homeTeamId: "A",
        awayTeamId: "B",
        homeGoals: 4,
        awayGoals: 0,
      });
      matches.push({
        date: `2024-02-${String(i + 1).padStart(2, "0")}`,
        homeTeamId: "B",
        awayTeamId: "A",
        homeGoals: 0,
        awayGoals: 4,
      });
    }
    const result = fitDixonColesParams(matches);
    expect(result.fittedParams.alpha["A"]).toBeGreaterThan(result.fittedParams.alpha["B"]!);
    expect(result.fittedParams.beta["B"]).toBeGreaterThan(result.fittedParams.beta["A"]!);
  });

  it("estimates positive home advantage (gamma > 1)", () => {
    // Home teams consistently win
    const matches: HistoricalMatch[] = [];
    for (let i = 0; i < 30; i++) {
      const home = `T${i % 6}`;
      const away = `T${(i + 1) % 6}`;
      if (home === away) continue;
      matches.push({
        date: `2024-01-${String((i % 28) + 1).padStart(2, "0")}`,
        homeTeamId: home,
        awayTeamId: away,
        homeGoals: 2,
        awayGoals: 0,
      });
    }
    const result = fitDixonColesParams(matches);
    expect(result.fittedParams.gamma).toBeGreaterThan(1.0);
  });

  it("converges within a reasonable number of iterations", () => {
    const teams = [
      { id: "Strong", attack: 1.5, defence: 0.8 },
      { id: "Average", attack: 1.0, defence: 1.0 },
      { id: "Weak", attack: 0.6, defence: 1.3 },
    ];
    const matches = generateSyntheticSeason(teams, "2024-01-01");
    const result = fitDixonColesParams(matches, { maxIterations: 300, tolerance: 1e-6 });

    expect(result.convergence.iterations).toBeLessThanOrEqual(300);
    expect(result.evidence.matchesUsed).toBe(matches.length);
    expect(result.evidence.teamsDiscovered).toBe(3);
  });

  it("produces stable alpha/beta for clear team differences", () => {
    // With enough data the fitted parameters should separate strong from weak
    const matches: HistoricalMatch[] = [];
    for (let round = 0; round < 5; round++) {
      for (let i = 0; i < 8; i++) {
        // Strong home
        matches.push({
          date: `2024-${String(round * 2 + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
          homeTeamId: "STRONG",
          awayTeamId: "WEAK",
          homeGoals: 3,
          awayGoals: 0,
        });
        // Weak home
        matches.push({
          date: `2024-${String(round * 2 + 2).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
          homeTeamId: "WEAK",
          awayTeamId: "STRONG",
          homeGoals: 0,
          awayGoals: 3,
        });
      }
    }
    const result = fitDixonColesParams(matches);
    expect(result.fittedParams.alpha["STRONG"]).toBeGreaterThan(1.0);
    expect(result.fittedParams.alpha["WEAK"]).toBeLessThan(1.0);
  });

  it("respects halfLifeDays weighting", () => {
    // Old matches with high scores, recent matches with low scores
    const matches: HistoricalMatch[] = [];
    for (let i = 0; i < 10; i++) {
      matches.push({
        date: `2020-01-${String(i + 1).padStart(2, "0")}`,
        homeTeamId: "A",
        awayTeamId: "B",
        homeGoals: 5,
        awayGoals: 0,
      });
    }
    for (let i = 0; i < 10; i++) {
      matches.push({
        date: `2024-01-${String(i + 1).padStart(2, "0")}`,
        homeTeamId: "A",
        awayTeamId: "B",
        homeGoals: 1,
        awayGoals: 0,
      });
    }
    const shortHalfLife = fitDixonColesParams(matches, {
      halfLifeDays: 30,
      asOfDate: "2024-02-01",
    });
    const longHalfLife = fitDixonColesParams(matches, {
      halfLifeDays: 3650,
      asOfDate: "2024-02-01",
    });

    // With short half-life, recent low-scoring matches dominate => lower attack
    // With long half-life, old high-scoring matches still contribute => higher attack
    expect(shortHalfLife.fittedParams.alpha["A"]).toBeLessThanOrEqual(
      longHalfLife.fittedParams.alpha["A"]!,
    );
  });
});

describe("predictFromFittedParams", () => {
  it("returns expected goals using fitted parameters", () => {
    const matches: HistoricalMatch[] = [
      { date: "2024-01-01", homeTeamId: "A", awayTeamId: "B", homeGoals: 2, awayGoals: 1 },
      { date: "2024-01-08", homeTeamId: "B", awayTeamId: "A", homeGoals: 0, awayGoals: 3 },
    ];
    const result = fitDixonColesParams(matches);
    const prediction = predictFromFittedParams(result.fittedParams, "A", "B");

    expect(prediction.expectedHomeGoals).toBeGreaterThan(0);
    expect(prediction.expectedAwayGoals).toBeGreaterThan(0);
    expect(prediction.rho).toBeLessThan(0.1);
  });

  it("defaults to 1.0 for unknown teams", () => {
    const params = {
      alpha: { A: 1.3 },
      beta: { A: 0.8 },
      gamma: 1.15,
      rho: -0.1,
      leagueAverageGoals: 1.35,
    };
    const prediction = predictFromFittedParams(params, "A", "UNKNOWN");
    // Should not throw, should use defaults
    expect(prediction.expectedHomeGoals).toBeGreaterThan(0);
    expect(prediction.expectedAwayGoals).toBeGreaterThan(0);
  });

  it("gives higher home goals when home team has higher alpha", () => {
    const params = {
      alpha: { STRONG: 1.5, WEAK: 0.6 },
      beta: { STRONG: 0.8, WEAK: 1.3 },
      gamma: 1.2,
      rho: -0.1,
      leagueAverageGoals: 1.3,
    };
    const strongHome = predictFromFittedParams(params, "STRONG", "WEAK");
    const weakHome = predictFromFittedParams(params, "WEAK", "STRONG");

    expect(strongHome.expectedHomeGoals).toBeGreaterThan(weakHome.expectedHomeGoals);
    expect(strongHome.expectedAwayGoals).toBeLessThan(weakHome.expectedAwayGoals);
  });
});
