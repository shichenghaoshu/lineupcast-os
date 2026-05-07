/** A historical match used for parameter fitting. */
export interface HistoricalMatch {
  date: string | Date;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
}

/** The fitted Dixon-Coles model parameters. */
export interface FittedParams {
  /** Per-team attack strength (multiplied by league average to get expected goals). */
  alpha: Record<string, number>;
  /** Per-team defence weakness (higher means more goals conceded). */
  beta: Record<string, number>;
  /** Home advantage multiplier applied to home expected goals. */
  gamma: number;
  /** Dixon-Coles correlation parameter for low-scoring outcomes (typically negative). */
  rho: number;
  /** Baseline league average goals per team per match. */
  leagueAverageGoals: number;
}

/** Result of a parameter fitting run. */
export interface CalibrationResult {
  modelName: "dixon-coles-fitted";
  modelVersion: "1.0.0";
  references: string[];
  explanation: string;
  fittedParams: FittedParams;
  convergence: {
    iterations: number;
    finalLogLikelihood: number;
    converged: boolean;
  };
  evidence: {
    matchesUsed: number;
    teamsDiscovered: number;
    halfLifeDays: number;
  };
}
