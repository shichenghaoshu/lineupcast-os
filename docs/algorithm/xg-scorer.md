# xG Scorer Layer

The xG scorer layer estimates which players are most likely to score by allocating a team's expected goals across likely participants.

## Purpose

- Rank player goal threat for a specific fixture.
- Explain why a player is a likely scoring candidate.
- Feed commentary prompts with transparent, auditable features.

## Inputs

| Input | Meaning |
| --- | --- |
| `teamExpectedGoals` | Team-level xG from the match model. |
| `projectedMinutes` | Expected player minutes, usually from lineup or role assumptions. |
| `recentXgPer90` | Recent expected goals per 90 minutes. |
| `shotsPer90` | Shot volume. |
| `penaltyShare` | Estimated share of team penalties taken by the player. |
| `position` | Coarse role adjustment. |
| `opponentDefenceStrength` | Opponent defensive concession strength. |

## Method

1. Normalize player attacking features within the squad.
2. Estimate each player's xG share from projected minutes, role, xG history, shots, and set-piece responsibility.
3. Allocate team expected goals:

```text
player_xg = teamExpectedGoals * normalized_player_share
```

4. Convert player xG to at-least-one-goal probability:

```text
P(score) = 1 - exp(-player_xg)
```

5. Rank players and attach the top contributing features as explanations.

## Outputs

| Output | Meaning |
| --- | --- |
| `playerExpectedGoals` | Player-level expected goals for the match. |
| `goalProbability` | Probability of scoring at least once. |
| `rank` | Squad-level scorer rank. |
| `drivers` | Human-readable reason codes for narration. |

## Commentary Use

Use this layer for phrases such as "highest projected goal threat" or "most likely scoring route". Avoid saying a player "will score".

## Known Weaknesses

- Projected minutes are uncertain before confirmed lineups.
- Penalty taker assumptions can change.
- xG models vary by provider and shot definition.
- Player role changes are only captured if input data reflects them.
