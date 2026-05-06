# Model Card: Dixon-Coles Match Outcome Prediction

> Based on [Model Cards for Model Reporting (Mitchell et al., 2019)](https://arxiv.org/abs/1810.03993)

## Model Details

- **Name:** dixon-coles
- **Version:** 1.0.0
- **Type:** Correlated Poisson model with time-weighted strength parameters
- **Owner:** LineupCast OS community
- **License:** MIT

## References

- Dixon, M.J. & Coles, S.G. (1997) Modelling Association Football Scores and Inefficiencies in the Football Betting Market. J. Royal Statistical Society: Series A, 60(4), 831-845.

## Intended Use

- Pre-match home/draw/away probability estimation
- Scoreline probability matrix generation
- Commentary preparation and data journalism

**Not intended for:** gambling advice, live trading, or high-stakes decisions.

## Input Features

| Feature | Description | Default |
|---------|-------------|---------|
| `homeTeam.attack` | Relative attacking strength (1.0 = avg) | — |
| `homeTeam.defence` | Relative defensive strength (lower = better) | — |
| `awayTeam.attack` | Relative attacking strength | — |
| `awayTeam.defence` | Relative defensive strength | — |
| `homeAdvantage` | HFA multiplier on home expected goals | 1.35 |
| `rho` | Low-score correlation correction | -0.13 |
| `leagueAvgGoals` | League average goals per team per match | 1.35 |
| `maxGoals` | Score matrix upper bound | 10 |
| `timeDecayFactor` | Recency weight per match | 0.97 |
| `matchesPlayed` | Matches used for strength estimates | 38 |

## Output

- `expectedHomeGoals`, `expectedAwayGoals`
- `scoreMatrix` — probability for each (home, away) scoreline up to maxGoals
- `homeWin`, `draw`, `awayWin` — outcome probabilities
- `confidence` — low / medium / high

## Limitations

- Assumes independent Poisson distributions (with rho correction)
- Strength parameters require sufficient historical data
- Does not account for red cards, injuries, or tactical changes
- Time decay may over-weight small recent samples
