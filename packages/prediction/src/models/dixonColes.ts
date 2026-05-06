import { poissonPmf, type PoissonScoreProbability } from "./poisson.js";
import { timeDecayWeight, toDate } from "./timeDecay.js";

export type Confidence = "low" | "medium" | "high";
export type MatchOutcome = "homeWin" | "draw" | "awayWin";

export interface MatchHistoryRecord {
  date: string | Date;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
}

export interface DixonColesHistoryInput {
  homeTeamId: string;
  awayTeamId: string;
  matchHistory: MatchHistoryRecord[];
  asOfDate?: string | Date;
  halfLifeDays?: number;
  homeAdvantage?: number;
  rho?: number;
  maxGoals?: number;
}

export interface DixonColesPrediction {
  modelName: "dixon-coles";
  modelVersion: "2.0.0";
  references: string[];
  explanation: string;
  evidence: {
    matchesUsed: number;
    halfLifeDays: number;
    leagueAverageGoals: number;
    homeAttackStrength: number;
    homeDefenceWeakness: number;
    awayAttackStrength: number;
    awayDefenceWeakness: number;
    rho: number;
  };
  confidence: Confidence;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  scoreMatrix: PoissonScoreProbability[];
  homeWin: number;
  draw: number;
  awayWin: number;
}

interface TeamRates {
  attack: number;
  defenceWeakness: number;
  weightedMatches: number;
}

function tau(homeGoals: number, awayGoals: number, lambda: number, mu: number, rho: number): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - lambda * mu * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + lambda * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + mu * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function normalizeOutcomes(homeWin: number, draw: number, awayWin: number): Pick<DixonColesPrediction, "homeWin" | "draw" | "awayWin"> {
  const total = homeWin + draw + awayWin;
  if (total <= 0) return { homeWin: 33.333333, draw: 33.333334, awayWin: 33.333333 };
  return {
    homeWin: (homeWin / total) * 100,
    draw: (draw / total) * 100,
    awayWin: (awayWin / total) * 100,
  };
}

function estimateTeamRates(teamId: string, matches: MatchHistoryRecord[], weights: number[], leagueAverageGoals: number): TeamRates {
  let weightedFor = 0;
  let weightedAgainst = 0;
  let weightedMatches = 0;

  matches.forEach((match, index) => {
    const weight = weights[index] ?? 0;
    if (match.homeTeamId === teamId) {
      weightedFor += match.homeGoals * weight;
      weightedAgainst += match.awayGoals * weight;
      weightedMatches += weight;
    } else if (match.awayTeamId === teamId) {
      weightedFor += match.awayGoals * weight;
      weightedAgainst += match.homeGoals * weight;
      weightedMatches += weight;
    }
  });

  const priorMatches = 3;
  const attackGoals = (weightedFor + leagueAverageGoals * priorMatches) / (weightedMatches + priorMatches);
  const defenceGoals = (weightedAgainst + leagueAverageGoals * priorMatches) / (weightedMatches + priorMatches);

  return {
    attack: attackGoals / leagueAverageGoals,
    defenceWeakness: defenceGoals / leagueAverageGoals,
    weightedMatches,
  };
}

export function predictDixonColesFromHistory(input: DixonColesHistoryInput): DixonColesPrediction {
  const asOf = toDate(input.asOfDate ?? new Date());
  const halfLifeDays = input.halfLifeDays ?? 180;
  const rho = input.rho ?? -0.1;
  const homeAdvantage = input.homeAdvantage ?? 1.1;
  const maxGoals = input.maxGoals ?? 10;
  const usableMatches = input.matchHistory
    .filter((match) => toDate(match.date).getTime() <= asOf.getTime())
    .sort((left, right) => toDate(left.date).getTime() - toDate(right.date).getTime());

  if (usableMatches.length === 0) throw new Error("matchHistory must contain at least one match before asOfDate");

  const weights = usableMatches.map((match) => timeDecayWeight(match.date, { asOfDate: asOf, halfLifeDays }));
  const weightedGoals = usableMatches.reduce((sum, match, index) => sum + (match.homeGoals + match.awayGoals) * (weights[index] ?? 0), 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const leagueAverageGoals = Math.max(0.2, weightedGoals / Math.max(1, totalWeight * 2));
  const homeRates = estimateTeamRates(input.homeTeamId, usableMatches, weights, leagueAverageGoals);
  const awayRates = estimateTeamRates(input.awayTeamId, usableMatches, weights, leagueAverageGoals);

  const expectedHomeGoals = Math.max(0.05, leagueAverageGoals * homeRates.attack * awayRates.defenceWeakness * homeAdvantage);
  const expectedAwayGoals = Math.max(0.05, leagueAverageGoals * awayRates.attack * homeRates.defenceWeakness);

  const rawScores: PoissonScoreProbability[] = [];
  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      const independent = poissonPmf(homeGoals, expectedHomeGoals) * poissonPmf(awayGoals, expectedAwayGoals);
      rawScores.push({
        homeGoals,
        awayGoals,
        probability: independent * Math.max(0.01, tau(homeGoals, awayGoals, expectedHomeGoals, expectedAwayGoals, rho)),
      });
    }
  }

  const scoreTotal = rawScores.reduce((sum, score) => sum + score.probability, 0);
  const scoreMatrix = rawScores.map((score) => ({ ...score, probability: (score.probability / scoreTotal) * 100 }));
  const outcomeTotals = scoreMatrix.reduce(
    (totals, score) => {
      if (score.homeGoals > score.awayGoals) totals.homeWin += score.probability;
      else if (score.homeGoals === score.awayGoals) totals.draw += score.probability;
      else totals.awayWin += score.probability;
      return totals;
    },
    { homeWin: 0, draw: 0, awayWin: 0 },
  );
  const outcomes = normalizeOutcomes(outcomeTotals.homeWin, outcomeTotals.draw, outcomeTotals.awayWin);
  const strongest = Math.max(outcomes.homeWin, outcomes.draw, outcomes.awayWin);
  const sample = Math.min(homeRates.weightedMatches, awayRates.weightedMatches);
  const confidence: Confidence = sample < 2 ? "low" : strongest > 58 ? "high" : strongest > 45 ? "medium" : "low";

  return {
    modelName: "dixon-coles",
    modelVersion: "2.0.0",
    references: [
      "Dixon, M.J. & Coles, S.G. (1997) Modelling Association Football Scores and Inefficiencies in the Football Betting Market.",
      "Maher, M.J. (1982) Modelling association football scores.",
    ],
    explanation: `Dixon-Coles time-weighted Poisson model estimated team attack and defensive weakness from ${usableMatches.length} historical matches, then applied low-score rho correction and normalized outcomes to percentages.`,
    evidence: {
      matchesUsed: usableMatches.length,
      halfLifeDays,
      leagueAverageGoals: round(leagueAverageGoals),
      homeAttackStrength: round(homeRates.attack),
      homeDefenceWeakness: round(homeRates.defenceWeakness),
      awayAttackStrength: round(awayRates.attack),
      awayDefenceWeakness: round(awayRates.defenceWeakness),
      rho,
    },
    confidence,
    expectedHomeGoals: round(expectedHomeGoals),
    expectedAwayGoals: round(expectedAwayGoals),
    scoreMatrix,
    homeWin: outcomes.homeWin,
    draw: outcomes.draw,
    awayWin: outcomes.awayWin,
  };
}
