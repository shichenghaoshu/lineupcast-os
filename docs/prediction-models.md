# Prediction Models

LineupCast OS uses a **paper-backed prediction lab**. No LLM directly predicts match outcomes. All prediction models are deterministic, parameterised, and auditable. An LLM may be used to *summarise* or *present* model outputs, but never to generate the numerical predictions themselves.

See [Why AI Does Not Directly Predict](./papers.md#why-ai-does-not-directly-predict) for the rationale.

## Models

| Model | Type | Key Reference | File |
|-------|------|---------------|------|
| [Dixon-Coles](./model-cards/dixon-coles.md) | Match outcome probabilities | Dixon & Coles (1997) | `packages/prediction/src/dixonColes.ts` |
| [xG Share](./model-cards/xg-share.md) | Goal scorer probability | StatBomb xG framework | `packages/prediction/src/goalScorer.ts` |
| [xB-Inspired Card Risk](./model-cards/xb-inspired-card-risk.md) | Yellow/red card risk | Mariscal et al. (2024) | `packages/prediction/src/cardRisk.ts` |
| [Player Rating Adjustment](./model-cards/player-rating-adjustment.md) | Contextual rating shift | Daley & Matthews (2022) | `packages/prediction/src/playerRating.ts` |
| [Explanation Layer](./model-cards/explanation-layer.md) | Deterministic reasoning | Rule-based templates | `packages/prediction/src/explanation.ts` |

## Model Contract

Every model must expose:

- `modelName` — unique identifier
- `modelVersion` — semver string
- `references` — academic papers backing the approach
- `inputFeatures` — list of features used
- `confidence` — categorical (low / medium / high)
- `explanation` or `explanations` — deterministic reasoning chain

## Architecture

```
Input Data → Feature Extraction → Deterministic Model → Output + Explanation
                                                    ↓
                                          Explanation Layer (rule-based)
                                                    ↓
                                          Human-readable summary
```

No stochastic sampling, no LLM-in-the-loop for numerical output.
