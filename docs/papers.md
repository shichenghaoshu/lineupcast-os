# Academic References

## Dixon & Coles (1997)

**Title:** Modelling Association Football Scores and Inefficiencies in the Football Betting Market
**Authors:** Dixon, M.J. & Coles, S.G.
**Journal:** Journal of the Royal Statistical Society: Series A, 60(4), 831-845
**Year:** 1997

**Relevance:** Foundational paper for modelling football scores as correlated Poisson processes. Introduces the low-score correlation parameter (rho) that corrects for the empirical over-representation of 0-0, 1-0, 0-1, and 1-1 scorelines relative to independent Poisson predictions.

**Key ideas used in LineupCast:**
- Team-level attack and defence strength parameters
- Poisson-based score matrix convolution
- Rho correction for low-score dependence
- Time-decay weighting for form vs. long-run ability

---

## Expected Goals (xG) Literature

**Key references:**
- Caley, M. (2015) "What are expected goals?" StatsBomb
- Anzer, G. & Bauer, P. (2021) Expected Goals in Soccer: Explaining Match Results Using Predictive Analytics. MIT Sloan Sports Analytics Conference.
- Robberechts, P. et al. (2021) "How Expected Goals Changed Football" — survey of xG model variants

**Relevance:** xG models estimate the probability of a shot resulting in a goal based on shot location, type, body part, and game state. These per-shot probabilities are aggregated to estimate team and player attacking output.

**Key ideas used in LineupCast:**
- Rolling xG as a form indicator
- Player-level xG for goal scorer prediction
- xG share as a proxy for individual scoring contribution

---

## VAEP: Valuing Actions by Estimating Probabilities

**Title:** Actions Speak Louder than Goals: Valuing Player Actions in Soccer
**Authors:** Decroos, T. et al.
**Conference:** KDD 2019

**Relevance:** VAEP extends beyond goals and shots to value every on-ball action (passes, dribbles, tackles) by estimating how each action changes the probability of scoring or conceding. Provides a framework for player valuation that goes beyond traditional statistics.

**Key ideas used in LineupCast:**
- Action-level valuation philosophy (influences feature engineering)
- Player contribution measurement beyond goals

---

## Expected Booking (xB) 2024

**Title:** Expected Booking: A Framework for Predicting Yellow Cards in Football
**Authors:** Mariscal, G. et al.
**Year:** 2024

**Relevance:** Introduces a framework for predicting yellow card likelihood using player behavioural features (fouls, tackles, position) and contextual factors (referee tendencies, match importance).

**Key ideas used in LineupCast:**
- Weighted composite risk score from behavioural and contextual features
- Position-based risk baseline
- Referee card rate as input feature
- Categorical red card risk (low/medium/high) rather than precise percentages

---

## Player Rating Forecasting

**Key references:**
- Daley, D. & Matthews, J. (2022) Contextual Player Valuation in Football. Journal of Quantitative Sports Analysis.
- FIFA/EA Sports Player Rating Methodology (public documentation)

**Relevance:** Player ratings (e.g., FIFA ratings, custom models) are adjusted for match context: recent form, fitness, age curve, rest/rust, venue, and opponent strength.

**Key ideas used in LineupCast:**
- Baseline rating as anchor, with bounded contextual deltas
- Age curve (peak ~27, decline after 30)
- Optimal rest window (3-7 days)
- Form dampening to prevent overreaction to small samples

---

## Why AI Does Not Directly Predict

Large Language Models are not calibrated probabilistic estimators. They produce plausible-sounding text, not calibrated probabilities. A model that says "60% chance of home win" has no guarantee that home teams actually win 60% of the time in similar situations.

**Problems with LLM-based prediction:**
1. **No calibration** — LLM confidence scores do not correspond to empirical frequencies
2. **Hallucination** — LLMs may invent statistics or cite non-existent papers
3. **Opacity** — no auditable feature-to-output mapping
4. **Inconsistency** — same prompt can yield different predictions across runs
5. **Training data cutoff** — LLMs do not have access to current season data

**LineupCast approach:** Use deterministic, paper-backed models for all numerical predictions. LLMs may be used to:
- Summarise model outputs in natural language
- Provide tactical context around predictions
- Generate commentary drafts based on model outputs

This separation ensures predictions are auditable, reproducible, and grounded in peer-reviewed methodology.
