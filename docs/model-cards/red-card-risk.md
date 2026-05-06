# Model Card: Red Card Risk (Categorical)

> Based on [Model Cards for Model Reporting (Mitchell et al., 2019)](https://arxiv.org/abs/1810.03993)

## Model Details

- **Name:** red-card-risk (subset of xb-inspired-card-risk)
- **Version:** 1.0.0
- **Type:** Categorical risk classification
- **Owner:** LineupCast OS community
- **License:** MIT

## References

- Mariscal, G. et al. (2024) Expected Booking: A Framework for Predicting Yellow Cards in Football

## Design Decision

Red card prediction is **intentionally categorical** (low / medium / high), not a precise percentage. This is a deliberate design choice:

1. Red cards are rare events (~0.05 per match) — precise probabilities are unreliable
2. The mechanisms differ (last-man denial, violent conduct, second yellow) — a single probability obscures these
3. Users benefit more from a clear risk tier than a false-precision number

## Classification Thresholds

| Risk Level | Composite Risk Score | Interpretation |
|------------|---------------------|----------------|
| Low | < 0.4 | Normal match context |
| Medium | 0.4 - 0.65 | Elevated risk (aggressive player, card-happy ref, high pressure) |
| High | > 0.65 | Multiple risk factors aligned |

## Limitations

- Thresholds are heuristic, not empirically optimised
- Does not distinguish between second-yellow and straight-red risk
- Very few training examples for "high" category
