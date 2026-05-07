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

/** Degradation flags indicating which inputs were missing or imputed. */
export interface DegradationFlags {
  lowSampleSize: boolean;
  missingTeamHistory: boolean;
  extremeStrengthClamped: boolean;
  defaultRhoUsed: boolean;
  defaultHomeAdvantageUsed: boolean;
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
    degradationFlags: DegradationFlags;
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

/** Clamp a number to [min, max]. */
function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Maximum allowed strength multiplier to prevent runaway predictions. */
const MAX_STRENGTH = 3.0;
const MIN_STRENGTH = 0.15;

export function predictDixonColesFromHistory(input: DixonColesHistoryInput): DixonColesPrediction {
  const asOf = toDate(input.asOfDate ?? new Date());
  const halfLifeDays = input.halfLifeDays ?? 180;
  const rho = clampValue(input.rho ?? -0.1, -0.5, 0.5);
  const homeAdvantage = clampValue(input.homeAdvantage ?? 1.1, 0.8, 1.8);
  const maxGoals = input.maxGoals ?? 10;

  const degradationFlags: DegradationFlags = {
    lowSampleSize: false,
    missingTeamHistory: false,
    extremeStrengthClamped: false,
    defaultRhoUsed: input.rho === undefined,
    defaultHomeAdvantageUsed: input.homeAdvantage === undefined,
  };

  const usableMatches = input.matchHistory
    .filter((match) => toDate(match.date).getTime() <= asOf.getTime())
    .sort((left, right) => toDate(left.date).getTime() - toDate(right.date).getTime());

  if (usableMatches.length === 0) throw new Error("matchHistory must contain at least one match before asOfDate");

  const weights = usableMatches.map((match) => timeDecayWeight(match.date, { asOfDate: asOf, halfLifeDays }));
  const weightedGoals = usableMatches.reduce((sum, match, index) => sum + (match.homeGoals + match.awayGoals) * (weights[index] ?? 0), 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const leagueAverageGoals = clampValue(weightedGoals / Math.max(1, totalWeight * 2), 0.2, 5.0);

  const homeRates = estimateTeamRates(input.homeTeamId, usableMatches, weights, leagueAverageGoals);
  const awayRates = estimateTeamRates(input.awayTeamId, usableMatches, weights, leagueAverageGoals);

  // Flag missing team history when weighted match count is very low
  const homeMatches = homeRates.weightedMatches;
  const awayMatches = awayRates.weightedMatches;
  if (homeMatches < 1) degradationFlags.missingTeamHistory = true;
  if (awayMatches < 1) degradationFlags.missingTeamHistory = true;

  // Clamp attack/defence strengths to prevent extreme predictions
  const clampedHomeAttack = clampValue(homeRates.attack, MIN_STRENGTH, MAX_STRENGTH);
  const clampedHomeDefence = clampValue(homeRates.defenceWeakness, MIN_STRENGTH, MAX_STRENGTH);
  const clampedAwayAttack = clampValue(awayRates.attack, MIN_STRENGTH, MAX_STRENGTH);
  const clampedAwayDefence = clampValue(awayRates.defenceWeakness, MIN_STRENGTH, MAX_STRENGTH);
  if (
    clampedHomeAttack !== homeRates.attack || clampedHomeDefence !== homeRates.defenceWeakness ||
    clampedAwayAttack !== awayRates.attack || clampedAwayDefence !== awayRates.defenceWeakness
  ) {
    degradationFlags.extremeStrengthClamped = true;
  }

  const expectedHomeGoals = clampValue(leagueAverageGoals * clampedHomeAttack * clampedAwayDefence * homeAdvantage, 0.05, 8.0);
  const expectedAwayGoals = clampValue(leagueAverageGoals * clampedAwayAttack * clampedHomeDefence, 0.05, 8.0);

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

  // Guard against degenerate score matrix (all zeros)
  const scoreMatrix = scoreTotal > 0
    ? rawScores.map((score) => ({ ...score, probability: round((score.probability / scoreTotal) * 100, 4) }))
    : rawScores.map((score) => ({ ...score, probability: 0 }));

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

  // Verify normalization: probabilities must sum to ~100% (within 0.5%)
  const outcomeSum = outcomes.homeWin + outcomes.draw + outcomes.awayWin;
  if (Math.abs(outcomeSum - 100) > 0.5) {
    // Force re-normalization if drift detected
    const correction = normalizeOutcomes(outcomes.homeWin, outcomes.draw, outcomes.awayWin);
    outcomes.homeWin = correction.homeWin;
    outcomes.draw = correction.draw;
    outcomes.awayWin = correction.awayWin;
  }

  const sample = Math.min(homeRates.weightedMatches, awayRates.weightedMatches);
  if (sample < 3) degradationFlags.lowSampleSize = true;

  // Confidence degrades with low sample size and missing data
  const strongest = Math.max(outcomes.homeWin, outcomes.draw, outcomes.awayWin);
  let confidence: Confidence;
  if (sample < 2 || degradationFlags.missingTeamHistory) {
    confidence = "low";
  } else if (strongest > 58 && sample >= 5) {
    confidence = "high";
  } else if (strongest > 45 && sample >= 3) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

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
      homeAttackStrength: round(clampedHomeAttack),
      homeDefenceWeakness: round(clampedHomeDefence),
      awayAttackStrength: round(clampedAwayAttack),
      awayDefenceWeakness: round(clampedAwayDefence),
      rho,
      degradationFlags,
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
