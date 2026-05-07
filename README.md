# LineupCast OS

> Open-source football pre-match commentary data cockpit — turn raw match data into broadcast-ready talking points.

## Features

- **Match Dashboard** — aggregated pre-match data for upcoming fixtures
- **Head-to-Head Explorer** — historical matchup stats and trend charts
- **Form Tracker** — rolling performance windows for teams and players
- **Prediction Engine** — open-source xG-based model for match outcome probabilities
- **AI Script Generator** — turn stats into structured commentary scripts
- **Overlay Renderer** — export broadcast-ready graphics as PNG/HTML

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS, Recharts, Framer Motion |
| API | FastAPI, Pydantic, Uvicorn |
| Packages | TypeScript (ESM), shared schemas, data providers |
| Database | PostgreSQL 16 |
| Tooling | pnpm workspaces, ESLint, Prettier, Vitest, mypy |

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm 9+, Python 3.11+, PostgreSQL 16+

# Clone and install
git clone https://github.com/shichenghaoshu/lineupcast-os.git
cd lineupcast-os
cp .env.example .env
make install

# Start everything
make dev
# or individually:
#   pnpm dev:web   → http://localhost:3000
#   pnpm dev:api   → http://localhost:8000
```

## Prediction Model

LineupCast ships a lightweight **xG-weighted Poisson model** that estimates match outcome probabilities from historical shot data. The model is intentionally transparent — no black-box ML, just interpretable math you can audit. See [`docs/model-card-template.md`](docs/model-card-template.md) for the full model card.

## Real Algorithm Layer

LineupCast separates probability calculation from AI narration.

- **Dixon-Coles match outcome model** calculates scoreline, home/draw/away, and expected-goal probabilities.
- **xG scorer layer** allocates team expected goals across likely scorers.
- **xB-inspired card risk layer** estimates yellow-card pressure and categorical red-card risk.
- **Player rating adjustment** modifies team strength when reliable lineup or availability inputs exist.
- **Calibration checks** decide whether outputs should be shown as percentages, rounded bands, or directional rankings.

Algorithm docs live in [`docs/algorithm`](docs/algorithm).

Models calculate. AI narrates. For commentary assistance, not betting advice.

## Hugging Face Integration

LineupCast can use Hugging Face for the narration layer while keeping the football model calculations local and auditable.

- **Hugging Face Spaces:** see [`docs/deployment/huggingface-spaces.md`](docs/deployment/huggingface-spaces.md) and [`deploy/huggingface-space`](deploy/huggingface-space).
- **Hugging Face Inference Endpoints:** see [`docs/deployment/huggingface-inference-endpoint.md`](docs/deployment/huggingface-inference-endpoint.md).
- **OpenAI-compatible endpoints:** see [`docs/deployment/openai-compatible-endpoint.md`](docs/deployment/openai-compatible-endpoint.md).

Set provider variables in `.env`; see [`docs/env.md`](docs/env.md).

## Data Sources

All data is sourced from **open, freely-available football datasets**:

- [Football-Data.co.uk](https://www.football-data.co.uk/) — match results, odds
- [FBref](https://fbref.com/) — advanced player/team stats (via community scrapers)
- [OpenFootball](https://github.com/openfootball) — structured match data

No commercial API keys are required. Provider adapters live in `packages/providers`.

## Disclaimer

LineupCast OS is an **educational and analytical tool**. It is not a betting service. Predictions are probabilistic estimates based on historical data — they are not guarantees. Always verify information independently. See [`docs/limitations.md`](docs/limitations.md).

## Roadmap

See [`docs/current-review-and-roadmap.md`](docs/current-review-and-roadmap.md) for the current code review, known risks, and future roadmap.

Current status:

- [x] Demo match dashboard with form, H2H, prediction, lineup, script, data-source, and overlay screens
- [x] Deterministic prediction package with Dixon-Coles, scorer, card-risk, calibration, and backtest utilities
- [x] FastAPI demo API with health/readiness, script, prediction, model, provider, import, and overlay contracts
- [x] Python-to-TypeScript bridge scripts for local prediction and script generation
- [ ] Production data persistence and auth for write/admin endpoints
- [ ] One fully complete live provider path for fixtures, squads, lineups, form, H2H, and match stats
- [ ] Published calibration reports by league and season

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
