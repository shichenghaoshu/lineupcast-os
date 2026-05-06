# Model Card: xB-Inspired Card Risk

> Based on [Model Cards for Model Reporting (Mitchell et al., 2019)](https://arxiv.org/abs/1810.03993)

## Model Details

- **Name:** xb-inspired-card-risk
- **Version:** 1.0.0
- **Type:** Weighted composite booking risk model
- **Owner:** LineupCast OS community
- **License:** MIT

## References

- Mariscal, G. et al. (2024) Expected Booking: A Framework for Predicting Yellow Cards in Football
- Decroos, T. et al. (2019) Actions Speak Louder than Goals. KDD.

## Intended Use

- Pre-match yellow card risk assessment per player
- Commentary context for disciplinary trends
- Red card risk as categorical only (low / medium / high)

**Not intended for:** precise card probability claims or gambling.

## Input Features

| Feature | Description | Weight |
|---------|-------------|--------|
| `yellowCardsPer90` | Historical yellows per 90 | 0.25 |
| `foulsPer90` | Fouls committed per 90 | 0.25 |
| `position` | DEF highest risk, GK lowest | 0.15 |
| `opponentDribbleThreat` | Opponent dribble success rate | 0.15 |
| `refereeCardsPerMatch` | Referee avg cards per match | 0.15 |
| `matchPressure` | Importance factor 0-1 | 0.05 |

## Output

- `yellowCardProbability` — 0-1
- `redCardRisk` — categorical: low / medium / high (no precise red percentage)
- `riskScore` — composite 0-1

## Limitations

- Yellow card probability is a proxy, not direct measurement
- Referee assignment may not be known at prediction time
- Match pressure is subjective
- Red card output is deliberately categorical only
