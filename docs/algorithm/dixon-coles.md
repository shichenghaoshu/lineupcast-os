# Dixon-Coles Match Outcome Model

The Dixon-Coles layer estimates full-time scorelines with a correlated Poisson model. It is the base match-outcome engine for LineupCast OS because it is transparent, data-light, and easy to audit.

## Purpose

- Estimate home win, draw, and away win probabilities.
- Produce a scoreline matrix for likely results.
- Provide expected goals inputs to downstream commentary and player modules.

## Inputs

| Input | Meaning |
| --- | --- |
| `homeAttack`, `awayAttack` | Relative attacking strength, centered around league average. |
| `homeDefence`, `awayDefence` | Relative defensive concession strength. Lower values mean stronger defence. |
| `homeAdvantage` | Home expected-goal multiplier. |
| `leagueAverageGoals` | League average goals per team per match. |
| `rho` | Low-score correlation correction. |
| `timeDecay` | Recency weighting for historical matches. |

## Method

1. Fit team attack and defence parameters from historical scores.
2. Weight recent matches more heavily using exponential decay.
3. Convert team strengths into expected goals:

```text
home_lambda = leagueAverageGoals * homeAttack * awayDefence * homeAdvantage
away_lambda = leagueAverageGoals * awayAttack * homeDefence
```

4. Generate independent Poisson probabilities for each scoreline.
5. Apply the Dixon-Coles correction to low-scoring cells, usually `0-0`, `1-0`, `0-1`, and `1-1`.
6. Sum the score matrix into home, draw, and away probabilities.

## Outputs

| Output | Meaning |
| --- | --- |
| `expectedHomeGoals` | Home expected goals. |
| `expectedAwayGoals` | Away expected goals. |
| `scoreMatrix` | Probability of each scoreline up to the configured goal cap. |
| `homeWinProbability` | Sum of matrix cells where home goals exceed away goals. |
| `drawProbability` | Sum of diagonal matrix cells. |
| `awayWinProbability` | Sum of matrix cells where away goals exceed home goals. |

## Commentary Use

The model output should be narrated as probability and match context, not certainty. Example: "The model leans toward the home side, mainly because their recent attacking rate is above league average."

## Guardrails

- Do not describe model output as betting advice.
- Do not imply the model knows unavailable lineups, injuries, or tactics.
- Always include the project disclaimer in generated public-facing commentary.
