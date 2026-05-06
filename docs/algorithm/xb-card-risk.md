# xB Card Risk Layer

The xB card risk layer is inspired by expected booking approaches. It estimates disciplinary risk from player behavior, opponent pressure, referee tendency, and match context.

## Purpose

- Surface players with elevated yellow-card risk.
- Provide categorical red-card caution for commentary.
- Keep disciplinary predictions conservative and explainable.

## Inputs

| Input | Meaning |
| --- | --- |
| `yellowCardsPer90` | Historical yellow cards per 90 minutes. |
| `foulsPer90` | Fouls committed per 90 minutes. |
| `duelsPer90` | Physical involvement proxy. |
| `position` | Role-based disciplinary baseline. |
| `opponentDribbleThreat` | Opponent tendency to force defensive actions. |
| `refereeCardsPerMatch` | Referee card rate when available. |
| `matchPressure` | Derby, knockout, table-pressure, or rivalry adjustment. |

## Method

1. Normalize player and match-context features to `0..1`.
2. Compute weighted booking pressure:

```text
risk_score =
  0.25 * yellowCardsPer90_norm +
  0.20 * foulsPer90_norm +
  0.15 * duelsPer90_norm +
  0.15 * position_risk +
  0.10 * opponentDribbleThreat_norm +
  0.10 * refereeCardsPerMatch_norm +
  0.05 * matchPressure
```

3. Calibrate the risk score into a yellow-card probability band.
4. Report red-card risk categorically only: `low`, `medium`, or `high`.

## Outputs

| Output | Meaning |
| --- | --- |
| `yellowCardProbability` | Estimated yellow-card probability. |
| `riskScore` | Composite normalized booking pressure. |
| `redCardRisk` | Categorical red-card risk band. |
| `drivers` | Feature-level explanation for narration. |

## Guardrails

- Treat red cards as rare-event categories, not precise probabilities.
- Avoid overconfident language for individual refereeing decisions.
- Do not use this output for betting advice.
