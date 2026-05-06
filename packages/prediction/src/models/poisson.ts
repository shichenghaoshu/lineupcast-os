export interface PoissonScoreProbability {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

export function poissonPmf(k: number, lambda: number): number {
  if (!Number.isInteger(k) || k < 0 || lambda < 0 || !Number.isFinite(lambda)) return 0;
  if (lambda === 0) return k === 0 ? 1 : 0;

  let logFactorial = 0;
  for (let i = 2; i <= k; i += 1) logFactorial += Math.log(i);

  return Math.exp(-lambda + k * Math.log(lambda) - logFactorial);
}

export function buildIndependentPoissonMatrix(
  expectedHomeGoals: number,
  expectedAwayGoals: number,
  maxGoals = 10,
): PoissonScoreProbability[] {
  const scores: PoissonScoreProbability[] = [];

  for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals += 1) {
      scores.push({
        homeGoals,
        awayGoals,
        probability: poissonPmf(homeGoals, expectedHomeGoals) * poissonPmf(awayGoals, expectedAwayGoals),
      });
    }
  }

  const total = scores.reduce((sum, score) => sum + score.probability, 0);
  return total > 0
    ? scores.map((score) => ({ ...score, probability: (score.probability / total) * 100 }))
    : scores;
}
