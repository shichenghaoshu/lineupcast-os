# Limitations & Known Issues

## Data Limitations

- **Historical coverage** — open datasets may have gaps for lower leagues or older seasons
- **Latency** — data is batch-updated, not real-time; expect hours-to-day delays
- **Granularity** — player-level xG may be unavailable for some competitions

## Model Limitations

- **No live in-play adjustment** — predictions are pre-match only
- **No injury/suspension awareness** — the base model uses team-level aggregates, not squad availability
- **Simplistic set-piece handling** — corners and free kicks are not separately modelled
- **Home advantage** — treated as a static constant; may vary by venue/crowd

## System Limitations

- **Single-league focus initially** — first release targets top-5 European leagues
- **No authentication** — v1 is single-user / local only
- **No mobile app** — responsive web only

## Disclaimer

This software is provided for educational and analytical purposes. It does not constitute financial, betting, or gambling advice. Predictions are probabilistic estimates — use at your own risk.
