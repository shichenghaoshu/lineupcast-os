# Limitations & Known Issues

> For commentary assistance, not betting advice.

This document outlines the known limitations of LineupCast OS. Understanding these boundaries is essential for correct interpretation of predictions and scripts.

---

## Not a Betting Product

LineupCast OS is **not a betting service, gambling tool, or financial advisory product**.

- Predictions are probabilistic estimates for commentary preparation, not wagering signals.
- No prediction carries a guarantee. Probabilities describe likelihood over many similar matches, not outcomes of individual fixtures.
- The system explicitly blocks betting-advice language (`ENABLE_BETTING_ADVICE=false`).
- Every generated script includes the disclaimer: "Models calculate. AI narrates. For commentary assistance, not betting advice."
- Users must verify all information independently before broadcast use.

**Do not use LineupCast predictions as the basis for betting decisions.**

---

## Algorithm Limitations

### Dixon-Coles Model

- **Pre-match only.** The model does not adjust for in-play events (red cards, injuries, substitutions, goals).
- **Poisson assumption.** Goals are modelled as independent Poisson events. In reality, game state affects scoring rates (e.g., a team leading 2-0 may sit back).
- **Low-score adjustment.** The Dixon-Coles rho parameter corrects for correlated 0-0 and 1-1 scorelines, but the correction is heuristic, not fitted from data in the current version.
- **Home advantage constant.** Treated as a fixed parameter. Does not vary by venue, crowd size, or travel distance.
- **No set-piece modelling.** Corners, free kicks, and penalties are not separately modelled. Teams with high set-piece xG may be undervalued.

### xG Scorer Layer

- **Aggregate xG allocation.** Team expected goals are distributed across likely scorers using historical shot-share weights. Individual match context (tactical role, opponent weakness) is not modelled.
- **No assist modelling.** The model predicts scorers but not assist providers.
- **Limited sample size.** Player xG over 5 matches may not be representative for players with few minutes.

### Card Risk Layer

- **Categorical output only.** Red-card risk is reported as low/medium/high, not as a probability. Rare-event calibration is not yet validated.
- **No referee modelling.** Card risk does not account for individual referee tendencies.
- **Fouls-per-90 proxy.** Uses fouls committed as a proxy for card risk. Does not account for foul severity or tactical fouling patterns.

### Calibration

- **League-specific calibration reports are not yet published.** The backtest utilities exist, but per-league, per-season calibration data is not available.
- **Historical performance does not guarantee future accuracy.** Model parameters may drift as team compositions and playing styles change.

---

## Data Source Limitations

### Open / Free Datasets

- **Coverage gaps.** Lower leagues, youth competitions, and women's football may have sparse or no data in open datasets.
- **Latency.** Open data sources are batch-updated, not real-time. Expect hours-to-day delays for match results and stats.
- **Granularity.** Player-level xG, advanced stats, and event data may be unavailable for some competitions.
- **Accuracy.** Community-scraped data (FBref via scrapers) may contain errors or be disrupted by site changes.

### football-data.org

- **Rate limits.** Free tier allows 10 requests/minute. High-volume use requires a paid plan.
- **Competition coverage.** Not all leagues are available on all plans. Check the provider's coverage list.
- **Lineup data.** Confirmed lineups are often not available until close to kickoff. Projected lineups may differ from actual.

### CSV Import

- **Manual effort.** CSV imports require users to source, format, and upload data themselves.
- **Staleness.** Imported data does not auto-update. Users must re-import to refresh.
- **Validation strictness.** The CSV parser enforces strict schemas. Data from external sources may need reformatting.

### LLM Narration

- **Hallucination risk.** LLMs may generate plausible but incorrect facts. All generated scripts should be reviewed before broadcast.
- **Language quality.** Bilingual output quality depends on the LLM. Smaller models may produce less fluent non-English text.
- **Latency.** LLM calls add 1-10 seconds to script generation depending on the provider and model size.
- **Cost.** LLM usage incurs API costs at the provider (OpenAI, Hugging Face). Costs are not included in LineupCast pricing.
- **Fallback content.** When the LLM is unavailable, the system generates a basic template script. This fallback is functional but less polished.

---

## System Limitations

### Current Version (V0.1.x)

- **Single-user / local only.** No authentication on read endpoints. Admin token protects write endpoints only.
- **No workspace isolation.** All data shares a single namespace.
- **No billing or usage tracking.** Free to run but no commercial infrastructure.
- **Mock data is the most complete path.** Real providers may lack fields needed for the full prediction workflow.

### Planned Improvements

| Limitation | Target Version | Status |
|-----------|---------------|--------|
| Authentication on all endpoints | V0.4 | Planned |
| Workspace isolation | V0.4 | Planned |
| Per-league calibration reports | V1.0 | Planned |
| Real-time data (live scores) | Post-V1.0 | Not started |
| Mobile app | Not planned | -- |
| In-play prediction | Not planned | -- |

---

## Interpretation Guidance

### What Predictions Mean

- A 60% home win probability means: "In matches with similar characteristics, the home team won approximately 60 times out of 100."
- It does **not** mean: "The home team will definitely win" or "You should bet on the home team."

### What Completeness Scores Mean

- A completeness score of 0.85 means: "85% of the data fields needed for a full-confidence prediction are available."
- Lower completeness = lower confidence cap = wider probability bands.
- A prediction with completeness 0.5 should be treated as directional guidance, not precise probabilities.

### What Degraded Mode Means

- When the system enters degraded mode, it is because critical data fields are missing.
- Degraded predictions are still generated but with reduced confidence.
- The UI clearly indicates degraded mode with visual indicators.

---

## Disclaimer

This software is provided for educational and analytical purposes. It does not constitute financial, betting, or gambling advice. Predictions are probabilistic estimates -- use at your own risk. Always verify information independently. For commentary assistance, not betting advice.
