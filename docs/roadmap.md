# Roadmap

## Near Term

- Keep the local Docker path runnable without PostgreSQL by default.
- Document each algorithm layer and safety boundary.
- Add structured narration contracts for Hugging Face and OpenAI-compatible endpoints.
- Expand API examples with request and response schemas.

## Algorithm Layer

- Add historical backtesting fixtures for Dixon-Coles.
- Add calibration reports by league and season.
- Version xG scorer weights separately from match-outcome weights.
- Keep red-card output categorical unless rare-event calibration is proven.

## Data Layer

- Add provider adapters behind explicit environment variables.
- Track provider freshness and missing-field status.
- Preserve synthetic demo data for local onboarding.

## AI Narration

- Add bilingual script schema validation.
- Add prompt templates with strict grounding requirements.
- Add provider-level timeouts and fallback messages.

## Deployment

- Keep Docker Compose as the default local deployment.
- Maintain the Hugging Face Spaces wrapper on port `7860`.
- Add deployment smoke tests for `/health`, `/healthz`, and `/readyz`.
