import { poissonPmf } from "../models/poisson.js";
import { timeDecayWeight, toDate } from "../models/timeDecay.js";
import type { HistoricalMatch, FittedParams, CalibrationResult } from "./types.js";

// ---------------------------------------------------------------------------
// Dixon-Coles tau correction for low-scoring outcomes
// ---------------------------------------------------------------------------

function tau(x: number, y: number, lambdaX: number, muY: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambdaX * muY * rho;
  if (x === 0 && y === 1) return 1 + lambdaX * rho;
  if (x === 1 && y === 0) return 1 + muY * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

// ---------------------------------------------------------------------------
// Log-likelihood contribution of a single match
// ---------------------------------------------------------------------------

function matchLogLikelihood(
  homeGoals: number,
  awayGoals: number,
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number {
  const tauVal = tau(homeGoals, awayGoals, lambdaHome, lambdaAway, rho);
  if (tauVal <= 0) return -1e6; // guard against invalid rho

  const homePoisson = poissonPmf(homeGoals, lambdaHome);
  const awayPoisson = poissonPmf(awayGoals, lambdaAway);
  const prob = homePoisson * awayPoisson * tauVal;

  if (prob <= 0) return -1e6;
  return Math.log(prob);
}

// ---------------------------------------------------------------------------
// Options for parameter fitting
// ---------------------------------------------------------------------------

export interface FitOptions {
  /** Half-life in days for exponential time-decay weighting. Default: 365. */
  halfLifeDays?: number;
  /** Reference date for time decay. Default: latest match date. */
  asOfDate?: string | Date;
  /** Maximum coordinate-descent iterations. Default: 200. */
  maxIterations?: number;
  /** Convergence threshold on log-likelihood change. Default: 1e-5. */
  tolerance?: number;
  /** Learning-rate shrinkage per iteration for rho updates. Default: 0.8. */
  rhoLearningRate?: number;
  /** Number of prior matches used as Bayesian regularisation prior. Default: 5. */
  priorStrength?: number;
}

// ---------------------------------------------------------------------------
// Helper: gather unique team IDs
// ---------------------------------------------------------------------------

function discoverTeams(matches: HistoricalMatch[]): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    set.add(m.homeTeamId);
    set.add(m.awayTeamId);
  }
  return [...set].sort();
}

// ---------------------------------------------------------------------------
// Core fitting function using iterative reweighted least-squares style
// coordinate descent on the Dixon-Coles log-likelihood.
// ---------------------------------------------------------------------------

export function fitDixonColesParams(
  historicalMatches: HistoricalMatch[],
  options: FitOptions = {},
): CalibrationResult {
  if (historicalMatches.length === 0) {
    throw new Error("fitDixonColesParams requires at least one historical match");
  }

  const halfLifeDays = options.halfLifeDays ?? 365;
  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.tolerance ?? 1e-5;
  const rhoLR = options.rhoLearningRate ?? 0.8;
  const priorStrength = options.priorStrength ?? 5;

  // Sort matches chronologically
  const sorted = [...historicalMatches].sort(
    (a, b) => toDate(a.date).getTime() - toDate(b.date).getTime(),
  );

  const asOf = options.asOfDate
    ? toDate(options.asOfDate)
    : toDate(sorted[sorted.length - 1]!.date);

  // Time-decay weights
  const weights = sorted.map((m) =>
    timeDecayWeight(m.date, { asOfDate: asOf, halfLifeDays }),
  );

  // Discover teams
  const teams = discoverTeams(sorted);
  const teamIndex = new Map<string, number>();
  teams.forEach((id, i) => teamIndex.set(id, i));
  const nTeams = teams.length;

  // League-average goals (weighted)
  let weightedGoals = 0;
  let totalWeight = 0;
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]!;
    const w = weights[i]!;
    weightedGoals += (m.homeGoals + m.awayGoals) * w;
    totalWeight += w;
  }
  const leagueAverageGoals = Math.max(0.2, weightedGoals / Math.max(1, totalWeight * 2));

  // Initialise parameters
  // alpha_i ~ attack strength, beta_i ~ defence weakness
  // gamma ~ home advantage multiplier, rho ~ low-score correlation
  const alpha = new Float64Array(nTeams).fill(1);
  const beta = new Float64Array(nTeams).fill(1);
  let gamma = 1.15;
  let rho = -0.13;

  // Compute expected goals for match i
  function lambdaHome(i: number): number {
    const m = sorted[i]!;
    const hi = teamIndex.get(m.homeTeamId)!;
    const ai = teamIndex.get(m.awayTeamId)!;
    return Math.max(0.01, leagueAverageGoals * alpha[hi]! * beta[ai]! * gamma);
  }

  function lambdaAway(i: number): number {
    const m = sorted[i]!;
    const hi = teamIndex.get(m.homeTeamId)!;
    const ai = teamIndex.get(m.awayTeamId)!;
    return Math.max(0.01, leagueAverageGoals * alpha[ai]! * beta[hi]!);
  }

  // Total log-likelihood
  function totalLogLikelihood(): number {
    let ll = 0;
    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i]!;
      ll += weights[i]! * matchLogLikelihood(
        m.homeGoals,
        m.awayGoals,
        lambdaHome(i),
        lambdaAway(i),
        rho,
      );
    }
    // Bayesian regularisation: prior pulls alpha and beta toward 1
    for (let t = 0; t < nTeams; t++) {
      ll -= 0.5 * priorStrength * (alpha[t]! - 1) ** 2;
      ll -= 0.5 * priorStrength * (beta[t]! - 1) ** 2;
    }
    return ll;
  }

  // ---- Coordinate descent ----

  let prevLL = totalLogLikelihood();

  for (let iter = 0; iter < maxIterations; iter++) {
    // 1) Update alpha (attack) for each team via gradient step
    for (let t = 0; t < nTeams; t++) {
      let grad = 0;
      let hess = 0;
      for (let i = 0; i < sorted.length; i++) {
        const m = sorted[i]!;
        const w = weights[i]!;
        const hi = teamIndex.get(m.homeTeamId)!;
        const ai = teamIndex.get(m.awayTeamId)!;

        // Team plays at home
        if (hi === t) {
          const lam = lambdaHome(i);
          // d log P / d alpha_t for home Poisson: (goals - lambda) * (beta_away * gamma * leagueAvg) / lambda * alpha_t
          // Simplify: (goals/lambda - 1) * lambda/alpha  (chain rule)
          const ratio = m.homeGoals / lam - 1;
          grad += w * ratio;
          hess += w * m.homeGoals / (lam * lam) * (lam / alpha[t]!);
        }
        // Team plays away
        if (ai === t) {
          const lam = lambdaAway(i);
          const ratio = m.awayGoals / lam - 1;
          grad += w * ratio;
          hess += w * m.awayGoals / (lam * lam) * (lam / alpha[t]!);
        }
      }
      // Regularisation
      grad -= priorStrength * (alpha[t]! - 1);
      hess += priorStrength;

      if (hess > 0) {
        alpha[t] = Math.max(0.1, alpha[t]! + grad / hess);
      }
    }

    // 2) Update beta (defence) for each team
    for (let t = 0; t < nTeams; t++) {
      let grad = 0;
      let hess = 0;
      for (let i = 0; i < sorted.length; i++) {
        const m = sorted[i]!;
        const w = weights[i]!;
        const hi = teamIndex.get(m.homeTeamId)!;
        const ai = teamIndex.get(m.awayTeamId)!;

        // Team is home (away team's attack * home team's beta)
        if (hi === t) {
          const lam = lambdaAway(i); // away expected goals depend on beta[home]
          const ratio = m.awayGoals / lam - 1;
          grad += w * ratio;
          hess += w * m.awayGoals / (lam * lam) * (lam / beta[t]!);
        }
        // Team is away (home team's attack * away team's beta)
        if (ai === t) {
          const lam = lambdaHome(i); // home expected goals depend on beta[away]
          const ratio = m.homeGoals / lam - 1;
          grad += w * ratio;
          hess += w * m.homeGoals / (lam * lam) * (lam / beta[t]!);
        }
      }
      // Regularisation
      grad -= priorStrength * (beta[t]! - 1);
      hess += priorStrength;

      if (hess > 0) {
        beta[t] = Math.max(0.1, beta[t]! + grad / hess);
      }
    }

    // 3) Update gamma (home advantage)
    {
      let grad = 0;
      let hess = 0;
      for (let i = 0; i < sorted.length; i++) {
        const m = sorted[i]!;
        const w = weights[i]!;
        const lam = lambdaHome(i);
        const ratio = m.homeGoals / lam - 1;
        grad += w * ratio;
        hess += w * m.homeGoals / (lam * lam) * (lam / gamma);
      }
      if (hess > 0) {
        gamma = Math.max(0.5, Math.min(2.0, gamma + grad / hess));
      }
    }

    // 4) Update rho via gradient ascent with damping
    {
      let grad = 0;
      for (let i = 0; i < sorted.length; i++) {
        const m = sorted[i]!;
        const w = weights[i]!;
        const lamH = lambdaHome(i);
        const lamA = lambdaAway(i);
        const tauVal = tau(m.homeGoals, m.awayGoals, lamH, lamA, rho);
        if (tauVal <= 0) continue;

        // d log(tau) / d rho
        let dTau = 0;
        if (m.homeGoals === 0 && m.awayGoals === 0) dTau = -lamH * lamA;
        else if (m.homeGoals === 0 && m.awayGoals === 1) dTau = lamH;
        else if (m.homeGoals === 1 && m.awayGoals === 0) dTau = lamA;
        else if (m.homeGoals === 1 && m.awayGoals === 1) dTau = -1;

        grad += w * dTau / tauVal;
      }
      rho += rhoLR * Math.max(-0.05, Math.min(0.05, grad));
      rho = Math.max(-0.5, Math.min(0.1, rho));
    }

    // Check convergence
    const currentLL = totalLogLikelihood();
    if (Math.abs(currentLL - prevLL) < tolerance) {
      // Build result
      const alphaMap: Record<string, number> = {};
      const betaMap: Record<string, number> = {};
      teams.forEach((id, i) => {
        alphaMap[id] = round(alpha[i]!);
        betaMap[id] = round(beta[i]!);
      });

      return {
        modelName: "dixon-coles-fitted",
        modelVersion: "1.0.0",
        references: [
          "Dixon, M.J. & Coles, S.G. (1997) Modelling Association Football Scores and Inefficiencies in the Football Betting Market.",
          "Karlis, D. & Ntzoufras, I. (2003) Analysis of sports data by using bivariate Poisson models.",
        ],
        explanation: `Fitted Dixon-Coles parameters from ${sorted.length} matches across ${nTeams} teams using maximum likelihood estimation with time-decay weighting (half-life ${halfLifeDays} days).`,
        fittedParams: {
          alpha: alphaMap,
          beta: betaMap,
          gamma: round(gamma),
          rho: round(rho),
          leagueAverageGoals: round(leagueAverageGoals),
        },
        convergence: {
          iterations: iter + 1,
          finalLogLikelihood: round(currentLL),
          converged: true,
        },
        evidence: {
          matchesUsed: sorted.length,
          teamsDiscovered: nTeams,
          halfLifeDays,
        },
      };
    }
    prevLL = currentLL;
  }

  // Did not converge within maxIterations
  const alphaMap: Record<string, number> = {};
  const betaMap: Record<string, number> = {};
  teams.forEach((id, i) => {
    alphaMap[id] = round(alpha[i]!);
    betaMap[id] = round(beta[i]!);
  });

  return {
    modelName: "dixon-coles-fitted",
    modelVersion: "1.0.0",
    references: [
      "Dixon, M.J. & Coles, S.G. (1997) Modelling Association Football Scores and Inefficiencies in the Football Betting Market.",
    ],
    explanation: `Fitted Dixon-Coles parameters from ${sorted.length} matches across ${nTeams} teams (did not fully converge).`,
    fittedParams: {
      alpha: alphaMap,
      beta: betaMap,
      gamma: round(gamma),
      rho: round(rho),
      leagueAverageGoals: round(leagueAverageGoals),
    },
    convergence: {
      iterations: maxIterations,
      finalLogLikelihood: round(prevLL),
      converged: false,
    },
    evidence: {
      matchesUsed: sorted.length,
      teamsDiscovered: nTeams,
      halfLifeDays,
    },
  };
}

// ---------------------------------------------------------------------------
// Utility: use fitted params to predict expected goals for a fixture
// ---------------------------------------------------------------------------

export function predictFromFittedParams(
  params: FittedParams,
  homeTeamId: string,
  awayTeamId: string,
): { expectedHomeGoals: number; expectedAwayGoals: number; rho: number } {
  const homeAlpha = params.alpha[homeTeamId] ?? 1;
  const awayBeta = params.beta[awayTeamId] ?? 1;
  const awayAlpha = params.alpha[awayTeamId] ?? 1;
  const homeBeta = params.beta[homeTeamId] ?? 1;

  return {
    expectedHomeGoals: Math.max(0.05, params.leagueAverageGoals * homeAlpha * awayBeta * params.gamma),
    expectedAwayGoals: Math.max(0.05, params.leagueAverageGoals * awayAlpha * homeBeta),
    rho: params.rho,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function round(value: number, places = 4): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
