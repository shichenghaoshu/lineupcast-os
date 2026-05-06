// Deterministic Explanation Layer
// Converts raw model outputs into human-readable reasoning chains

export interface ModelOutput {
  modelName: string;
  modelVersion: string;
  references: string[];
  inputFeatures: string[];
  confidence: string;
  explanation?: string;
  explanations?: string[];
}

export interface ExplanationResult {
  modelCard: string;
  summary: string;
  featureImportance: string[];
  limitations: string[];
  references: string[];
}

/** Feature importance ordering for each model. */
const FEATURE_IMPORTANCE: Record<string, string[]> = {
  "dixon-coles": [
    "Team attack/defence strength (highest weight in Poisson lambda)",
    "Home advantage factor (multiplier on home expected goals)",
    "Low-score correlation rho (Dixon-Coles correction for 0-0, 1-0, 0-1, 1-1)",
    "Time decay (recency weighting of historical data)",
    "League average goals (baseline rate)",
  ],
  "xg-share": [
    "Recent xG (strongest predictor of near-term scoring, 25% weight)",
    "Starter minutes (availability, 25% weight)",
    "Position (base rate modifier, 20% weight)",
    "Shots per 90 (volume indicator, 15% weight)",
    "Penalty taker status (10% weight)",
    "Opponent defence weakness (5% weight)",
  ],
  "xb-inspired-card-risk": [
    "Yellow cards per 90 (direct historical indicator, 25% weight)",
    "Fouls per 90 (behavioural proxy, 25% weight)",
    "Position risk (defenders highest, 15% weight)",
    "Opponent dribble threat (15% weight)",
    "Referee card rate (15% weight)",
    "Match pressure (5% weight)",
  ],
  "player-rating-adjustment": [
    "Recent form deviation from baseline (largest delta)",
    "Fitness / minutes played recently",
    "Age curve (peak ~27, decline after 30)",
    "Rest / rust (optimal 3-7 days between matches)",
    "Venue (home/away adjustment)",
    "Opponent strength",
  ],
};

const MODEL_LIMITATIONS: Record<string, string[]> = {
  "dixon-coles": [
    "Assumes goals follow independent Poisson distributions (with rho correction)",
    "Strength parameters require sufficient historical data to be reliable",
    "Does not account for red cards, injuries, or tactical changes mid-match",
    "Time decay may over-weight recent small samples",
  ],
  "xg-share": [
    "xG is a model itself — inherits xG estimation uncertainty",
    "Does not account for specific match-up dynamics (e.g., marking assignments)",
    "Penalty taker status may change during a match",
    "Position classification is coarse (does not capture free roles)",
  ],
  "xb-inspired-card-risk": [
    "Yellow card probability is a proxy, not a direct measurement",
    "Referee assignment may not be known at prediction time",
    "Match pressure is subjective and hard to quantify",
    "Red card risk is categorical only — no precise probability",
  ],
  "player-rating-adjustment": [
    "Baseline rating quality depends on source (FIFA, custom, etc.)",
    "Age curve is population-level, not individual",
    "Form over 5 matches has high variance",
    "Does not capture tactical fit or role changes",
  ],
};

/**
 * Generate a deterministic explanation for any model output.
 * No LLM involvement — all text is produced by rule-based templates.
 */
export function explain(output: ModelOutput): ExplanationResult {
  const name = output.modelName;
  const features = FEATURE_IMPORTANCE[name] ?? ["No feature importance data available"];
  const limitations = MODEL_LIMITATIONS[name] ?? ["No limitation data available"];

  const explanationLines: string[] = [];
  if (output.explanation) explanationLines.push(output.explanation);
  if (output.explanations && Array.isArray(output.explanations)) {
    explanationLines.push(...output.explanations);
  }

  const summary = explanationLines.length > 0
    ? explanationLines.join(" | ")
    : `Model ${name} v${output.modelVersion} produced output with confidence ${output.confidence}.`;

  const featureImportance = features.map((f, i) => `${i + 1}. ${f}`);

  return {
    modelCard: `${name} v${output.modelVersion}`,
    summary,
    featureImportance,
    limitations,
    references: output.references,
  };
}
