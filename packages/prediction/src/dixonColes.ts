// Dixon-Coles (1997) simplified time-weighted Poisson model
// Reference: Dixon, M.J. & Coles, S.G. (1997) "Modelling Association Football Scores and Inefficiencies in the Football Betting Market"

/** Team attacking/defensive strength parameters. */
export interface TeamStrength {
  teamId: string;
  attack: number; // relative attacking strength (1.0 = league average)
  defence: number; // relative defensive strength (1.0 = league average, lower = better)
}

/** Probability of a specific scoreline. */
export interface ScoreProbability {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

/** Full match outcome prediction from Dixon-Coles model. */
export interface MatchOutcomePrediction {
  modelName: "dixon-coles";
  modelVersion: "1.0.0";
  references: string[];
  inputFeatures: string[];
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  scoreMatrix: ScoreProbability[];
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: "low" | "medium" | "high";
  explanations: string[];
}

interface DixonColesInput {
  homeTeam: TeamStrength;
  awayTeam: TeamStrength;
  homeAdvantage?: number; // default 1.35 (standard HFA multiplier)
  rho?: number; // low-score correlation correction, default -0.13
  leagueAvgGoals?: number; // default 1.35 per team per match
  maxGoals?: number; // score matrix upper bound, default 10
  timeDecayFactor?: number; // 0-1, weight of most recent data, default 0.97
  matchesPlayed?: number; // number of matches used for strength estimates
}

/** Dixon-Coles tau correction for low-score outcomes (0-0, 1-0, 0-1, 1-1). */
function tau(x: number, y: number, lambda: number, mu: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lambda * mu * rho;
  if (x === 0 && y === 1) return 1 + lambda * rho;
  if (x === 1 && y === 0) return 1 + mu * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
}

/** Poisson probability mass function. */
function poissonPMF(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute match outcome prediction using simplified Dixon-Coles model.
 *
 * Strength parameters (attack, defence) should be pre-calculated from
 * historical data using maximum likelihood or weighted least squares.
 * The time decay factor adjusts confidence in recent form vs. long-run average.
 */
export function predictDixonColes(input: DixonColesInput): MatchOutcomePrediction {
  const homeAdvantage = clamp(input.homeAdvantage ?? 1.35, 0.8, 1.8);
  const rho = clamp(input.rho ?? -0.13, -0.5, 0.5);
  const leagueAvg = clamp(input.leagueAvgGoals ?? 1.35, 0.2, 5.0);
  const maxGoals = input.maxGoals ?? 10;
  const timeDecay = clamp(input.timeDecayFactor ?? 0.97, 0.5, 1.0);
  const matches = Math.max(0, input.matchesPlayed ?? 38);

  // Clamp team strengths to prevent runaway predictions
  const homeAttackRaw = clamp(input.homeTeam.attack, 0.15, 3.0);
  const homeDefenceRaw = clamp(input.homeTeam.defence, 0.15, 3.0);
  const awayAttackRaw = clamp(input.awayTeam.attack, 0.15, 3.0);
  const awayDefenceRaw = clamp(input.awayTeam.defence, 0.15, 3.0);

  // Time-decayed lambda: blend raw estimate with league average based on sample size
  const decayWeight = 1 - Math.pow(timeDecay, matches);
  const homeAttack = homeAttackRaw * decayWeight + (1 - decayWeight);
  const homeDefence = homeDefenceRaw * decayWeight + (1 - decayWeight);
  const awayAttack = awayAttackRaw * decayWeight + (1 - decayWeight);
  const awayDefence = awayDefenceRaw * decayWeight + (1 - decayWeight);

  // Expected goals per Dixon-Coles: lambda = attack_i * defence_j * league_avg * HFA
  const lambdaHome = clamp(homeAttack * awayDefence * leagueAvg * homeAdvantage, 0.05, 8.0);
  const lambdaAway = clamp(awayAttack * homeDefence * leagueAvg, 0.05, 8.0);

  const scoreMatrix: ScoreProbability[] = [];
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const raw = poissonPMF(h, lambdaHome) * poissonPMF(a, lambdaAway);
      const corrected = raw * tau(h, a, lambdaHome, lambdaAway, rho);
      scoreMatrix.push({ homeGoals: h, awayGoals: a, probability: corrected });

      if (h > a) homeWin += corrected;
      else if (h === a) draw += corrected;
      else awayWin += corrected;
    }
  }

  // Normalize score matrix probabilities to sum to 100%
  const matrixTotal = scoreMatrix.reduce((sum, score) => sum + score.probability, 0);
  if (matrixTotal > 0) {
    for (const score of scoreMatrix) {
      score.probability = (score.probability / matrixTotal) * 100;
    }
  }

  // Normalize outcome probabilities to sum to 100%
  const total = homeWin + draw + awayWin;
  if (total > 0) {
    homeWin = (homeWin / total) * 100;
    draw = (draw / total) * 100;
    awayWin = (awayWin / total) * 100;
  } else {
    homeWin = 33.33;
    draw = 33.34;
    awayWin = 33.33;
  }

  // Verify normalization: probabilities must sum to ~100% (within 0.5%)
  const outcomeSum = homeWin + draw + awayWin;
  if (Math.abs(outcomeSum - 100) > 0.5) {
    const scale = 100 / outcomeSum;
    homeWin *= scale;
    draw *= scale;
    awayWin *= scale;
  }

  const maxProb = Math.max(homeWin, draw, awayWin);
  const confidence: MatchOutcomePrediction["confidence"] =
    matches < 3 ? "low" : maxProb > 60 ? "high" : maxProb > 45 ? "medium" : "low";

  const explanations: string[] = [
    `Home expected goals: ${lambdaHome.toFixed(2)} (attack=${homeAttack.toFixed(2)}, defence multiplier from away=${awayDefence.toFixed(2)}, HFA=${homeAdvantage})`,
    `Away expected goals: ${lambdaAway.toFixed(2)} (attack=${awayAttack.toFixed(2)}, defence multiplier from home=${homeDefence.toFixed(2)})`,
    `Dixon-Coles rho correction applied for low-score bias (rho=${rho})`,
    `Time decay: weight=${decayWeight.toFixed(3)} after ${matches} matches (decay factor=${timeDecay})`,
  ];

  return {
    modelName: "dixon-coles",
    modelVersion: "1.0.0",
    references: [
      "Dixon, M.J. & Coles, S.G. (1997) Modelling Association Football Scores and Inefficiencies in the Football Betting Market. Journal of the Royal Statistical Society: Series A, 60(4), 831-845.",
    ],
    inputFeatures: [
      "homeTeam.attack",
      "homeTeam.defence",
      "awayTeam.attack",
      "awayTeam.defence",
      "homeAdvantage",
      "rho",
      "leagueAvgGoals",
      "maxGoals",
      "timeDecayFactor",
      "matchesPlayed",
    ],
    expectedHomeGoals: Math.round(lambdaHome * 1000) / 1000,
    expectedAwayGoals: Math.round(lambdaAway * 1000) / 1000,
    scoreMatrix,
    homeWin: Math.round(homeWin * 1000) / 1000,
    draw: Math.round(draw * 1000) / 1000,
    awayWin: Math.round(awayWin * 1000) / 1000,
    confidence,
    explanations,
  };
}
