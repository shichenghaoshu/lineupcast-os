# Model Card: Player Rating Adjustment

> Based on [Model Cards for Model Reporting (Mitchell et al., 2019)](https://arxiv.org/abs/1810.03993)

## Model Details

- **Name:** player-rating-adjustment
- **Version:** 1.0.0
- **Type:** Contextual delta adjustment on baseline rating
- **Owner:** LineupCast OS community
- **License:** MIT

## References

- Daley, D. & Matthews, J. (2022) Contextual Player Valuation in Football
- FIFA/EA Sports Player Rating Methodology (public documentation)

## Intended Use

- Adjusting a baseline player rating for a specific match context
- Pre-match player assessment
- Commentary context ("player X is in form / fatigued / declining")

**Not intended for:** precise performance prediction or transfer valuation.

## Input Features

| Feature | Description | Effect |
|---------|-------------|--------|
| `baselineRating` | Season-long rating 0-100 | Anchor |
| `recentForm` | Last 5 match avg rating | Dampened delta |
| `minutesLast30Days` | Fitness proxy | Penalty if <270 min |
| `age` | Player age | Peak at 27, decline after 30 |
| `daysSinceLastMatch` | Rest/rust | Optimal 3-7 days |
| `isHome` | Venue | +1 home, -0.5 away |
| `opponentStrength` | 0-1 | Harder opponent = penalty |

## Output

- `adjustedRating` — bounded 0-100
- `adjustment` — delta from baseline
- `confidence` — based on magnitude of total adjustment

## Limitations

- Baseline rating quality depends on source
- Age curve is population-level, not individual
- Form over 5 matches has high variance
- Does not capture tactical fit or role changes
