# Model Card: xG Share Goal Scorer Prediction

> Based on [Model Cards for Model Reporting (Mitchell et al., 2019)](https://arxiv.org/abs/1810.03993)

## Model Details

- **Name:** xg-share
- **Version:** 1.0.0
- **Type:** Weighted composite scorer using xG-derived features
- **Owner:** LineupCast OS community
- **License:** MIT

## References

- StatBomb xG open-source framework (2018+)
- Caley, M. (2015) "What are expected goals?", StatsBomb
- Anzer, G. & Bauer, P. (2021) Expected Goals in Soccer. MIT Sloan SAC

## Intended Use

- Per-player goal probability estimation for a specific match
- Goal scorer market context for commentary
- Player threat assessment

**Not intended for:** gambling advice or precise probability claims.

## Input Features

| Feature | Description | Weight |
|---------|-------------|--------|
| `starterMinutes` | Expected minutes (0-90) | 0.25 |
| `position` | GK / DEF / MID / FWD | 0.20 |
| `recentXG` | xG over last 5 matches | 0.25 |
| `shotsPer90` | Shots per 90 minutes | 0.15 |
| `isPenaltyTaker` | Boolean | 0.10 |
| `opponentDefenceStrength` | 0-1 (higher = weaker) | 0.05 |
| `teamExpectedGoals` | Team total xG for this match | scaling |

## Formula

```
score = starterMinutesWeight * 0.25
      + positionWeight * 0.20
      + recentXGWeight * 0.25
      + shotsPer90Weight * 0.15
      + penaltyTakerWeight * 0.10
      + opponentWeaknessWeight * 0.05

playerExpectedGoals = score * teamExpectedGoals * positionWeight
P(goal) = 1 - e^(-playerExpectedGoals)
```

## Limitations

- xG is a model itself — inherits xG estimation uncertainty
- Does not account for specific match-up dynamics
- Penalty taker status may change during a match
- Position classification is coarse
