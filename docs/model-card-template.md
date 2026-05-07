# Model Card: LineupCast Prediction Engine

> Template based on [Model Cards for Model Reporting (Mitchell et al., 2019)](https://arxiv.org/abs/1810.03993)

## Model Details

- **Name:** Dixon-Coles Time-Weighted Poisson
- **Type:** Time-weighted Poisson score model with low-score adjustment
- **Owner:** LineupCast OS community
- **Version:** 0.1.0
- **License:** MIT

## Intended Use

- Pre-match football outcome probability estimation
- Commentary preparation and data journalism
- Educational tool for understanding sports analytics

**Not intended for:** gambling advice, real-time trading, or high-stakes decision-making.

## Training Data

- Historical match results and open-data examples supplied by the user
- Coverage: depends on the configured provider and user-held data rights
- Features: attack strength, defense strength, home advantage, lineup integrity, recent score trend

## Model Architecture

1. Estimate expected goals (λ_home, λ_away) using weighted rolling xG averages
2. Fit Poisson distributions for each team's goal count
3. Convolve distributions to get P(home win), P(draw), P(away win)

## Evaluation

| Metric              | Value |
| ------------------- | ----- |
| Log-loss (test set) | TBD   |
| Brier score         | TBD   |
| Calibration         | TBD   |

## Ethical Considerations

- No individual player data is used beyond public match statistics
- No personal or sensitive data is collected
- Model transparency is prioritized — all parameters are auditable

## Caveats

- Model does not account for injuries, suspensions, tactical changes, or weather
- Performance degrades for leagues with sparse historical data
- Treat outputs as one input among many, not as ground truth
