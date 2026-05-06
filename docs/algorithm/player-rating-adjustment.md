# Player Rating Adjustment

The player rating adjustment layer modifies baseline team and player estimates when reliable squad information is available. It exists to keep the match model responsive to lineups without hiding the assumptions.

## Purpose

- Adjust team strength for missing or returning players.
- Translate individual role value into team attack, defence, and card-risk effects.
- Explain lineup-driven changes in generated commentary.

## Inputs

| Input | Meaning |
| --- | --- |
| `baselinePlayerRating` | Player quality estimate from historical contribution or provider rating. |
| `replacementRating` | Expected replacement quality. |
| `projectedMinutes` | Expected minutes for the player. |
| `role` | Goalkeeper, defender, midfielder, forward, or custom tactical role. |
| `availabilityStatus` | Available, doubtful, suspended, injured, rested, or unknown. |
| `teamDependency` | How much the team depends on this player in the relevant phase. |

## Method

1. Convert player status into expected minutes.
2. Estimate the gap between player and replacement value.
3. Scale the gap by projected minutes and team dependency.
4. Apply directional effects:

| Role effect | Model adjustment |
| --- | --- |
| Attacking value | Changes team expected goals and scorer allocation. |
| Defensive value | Changes opponent expected goals. |
| Midfield control | Changes both attacking and defensive strength with smaller coefficients. |
| Goalkeeper value | Changes opponent conversion and defensive rating. |
| Discipline profile | Changes card-risk priors. |

## Outputs

| Output | Meaning |
| --- | --- |
| `attackAdjustment` | Multiplicative or additive change to attack strength. |
| `defenceAdjustment` | Change to defensive concession strength. |
| `confidenceAdjustment` | Reduction when availability is uncertain. |
| `explanation` | Human-readable lineup effect. |

## Guardrails

- Unknown status should reduce confidence, not invent certainty.
- Do not double-count a player in both team form and lineup adjustment unless the data pipeline explicitly separates those effects.
- Commentary should state when lineup information is projected rather than confirmed.
