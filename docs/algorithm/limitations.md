# Algorithm Limitations

LineupCast OS is designed for commentary assistance and analytical education. Its models are transparent by design, but they remain approximations of a noisy sport.

## General Limitations

- Football outcomes are low-scoring and high-variance.
- Historical data can understate tactical, injury, weather, travel, and motivation effects.
- Public datasets may lag confirmed team news.
- Provider definitions for xG, shots, fouls, assists, and player positions can differ.
- Small samples are especially fragile for players, newly promoted teams, and cup rotations.

## Dixon-Coles Limitations

- Score models assume stable team strength over the estimation window.
- The low-score correction helps common football scorelines but does not model all tactical states.
- Goal caps in a score matrix can truncate very high-scoring tails.

## Scorer Layer Limitations

- Projected minutes and lineup assumptions dominate player-level goal estimates.
- Penalty taker, set-piece role, and position changes may not be known.
- A player can have strong xG history but face a tactical role that lowers shot volume.

## Card Risk Limitations

- Cards depend heavily on referee judgment and match state.
- Red cards are rare, so exact red-card probabilities are not robust.
- Historical discipline can be misleading after role or league changes.

## AI Narration Limitations

The AI layer explains and formats the model output. It should not invent new data, override the numeric model, or present probabilities as certainty.

Models calculate. AI narrates. For commentary assistance, not betting advice.
