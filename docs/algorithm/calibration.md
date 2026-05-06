# Calibration

Calibration checks whether predicted probabilities match observed frequencies. A model can rank teams well but still be poorly calibrated if, for example, events predicted at 60% happen only 45% of the time.

## Objectives

- Keep probability language honest.
- Detect drift across leagues, seasons, and providers.
- Decide whether model outputs should be shown as precise percentages or broad bands.

## Core Checks

| Check | Purpose |
| --- | --- |
| Reliability curve | Compare predicted probability buckets with observed outcomes. |
| Brier score | Measure probability accuracy for binary or multiclass events. |
| Log loss | Penalize confident wrong predictions. |
| Expected calibration error | Summarize bucket-level calibration gap. |
| Backtest by segment | Check league, season, team tier, home/away, and sample-size slices. |

## Workflow

1. Freeze a historical test set that was not used for tuning.
2. Generate predictions as they would have existed before each match.
3. Bucket predictions, for example `0-10%`, `10-20%`, and so on.
4. Compare predicted rates against actual observed rates.
5. Store model version, data snapshot, and calibration report together.
6. Adjust presentation:
   - Good calibration: percentages can be shown with normal caveats.
   - Mild calibration issues: use rounded percentages and confidence bands.
   - Poor calibration: show directional rankings only.

## Commentary Rules

- Prefer "leans", "projects", and "estimates" over deterministic verbs.
- Mention confidence bands when input quality is weak.
- Never convert a calibrated probability into a recommendation to bet.

## Release Gate

Every algorithm release should include:

- Model version.
- Data snapshot date.
- Evaluation period.
- Brier score and log loss.
- Reliability summary.
- Known failure segments.
