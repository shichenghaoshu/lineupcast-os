# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

LineupCast OS is an open-source football pre-match commentary data cockpit. It turns raw match data into broadcast-ready talking points. The system separates **deterministic probability calculation** (Dixon-Coles, xG scorer, card risk) from **AI narration** (commentary scripts). Models calculate; AI narrates.

## Common Commands

```bash
# Install all dependencies (creates Python venv automatically)
make install     # or: pnpm install

# Run everything in parallel
make dev         # or: pnpm dev

# Run individually
pnpm dev:web     # Next.js at http://localhost:3000
pnpm dev:api     # FastAPI at http://localhost:8000

# Lint, typecheck, test (all run across workspaces in parallel)
make lint        # pnpm -r --parallel run lint
make typecheck   # pnpm -r --parallel run typecheck
make test        # pnpm -r --parallel run test

# Build all packages
make build       # pnpm -r run build

# Format
make format      # prettier --write

# Clean
make clean       # removes node_modules, .next, dist dirs

# Single workspace commands
pnpm --filter @lineupcast/prediction test
pnpm --filter @lineupcast/web lint
pnpm --filter @lineupcast/api test

# Python API lint/test (inside apps/api after install)
cd apps/api && ./.venv/bin/ruff check app/ src/ tests/
cd apps/api && ./.venv/bin/pytest tests/ src/tests/
```

## Architecture

### Monorepo Layout (pnpm workspaces)

```
apps/
  web/          → Next.js 15 (App Router), TypeScript, Tailwind CSS, Recharts, Framer Motion
  api/          → FastAPI, Pydantic, SQLAlchemy, Uvicorn
packages/
  schema/       → Shared TypeScript types and validation contracts (the source of truth for data shapes)
  providers/    → Data source adapters (football-data.org, OpenFootball, StatsBomb, CSV, etc.)
  prediction/   → Deterministic match prediction engine (Dixon-Coles, xG scorer, card risk, calibration, backtest)
  ai-script/    → Commentary script generator (deterministic templates + optional LLM narration)
  overlay-renderer/ → Broadcast graphic export (PNG/HTML)
```

### Data Flow

1. **Providers** (`packages/providers`) fetch raw football data from open sources. Each adapter implements the `FootballDataProvider` contract. A registry tracks provider health, freshness, and fallback chains.
2. **Prediction** (`packages/prediction`) runs a Dixon-Coles Poisson model adjusted by player ratings, xG, VAEP, and discipline features. All models are deterministic and auditable -- no LLM involvement.
3. **AI Script** (`packages/ai-script`) generates structured commentary scripts. It uses deterministic templates by default and can optionally call an LLM for richer narration. Scripts include grounding reports that trace each claim back to source data.
4. **Schema** (`packages/schema`) defines the shared TypeScript interfaces used across all packages (Match, Player, Prediction, Lineup, Provider, etc.) and includes data completeness scoring logic.
5. **Web** (`apps/web`) is a Next.js 15 App Router frontend that fetches from the API via `src/lib/api-client.ts`, with automatic fallback to bundled demo data when the API is unreachable.
6. **API** (`apps/api`) is a FastAPI service exposing prediction, script, overlay, provider, and import endpoints. It supports SQLite (dev) and PostgreSQL (prod).

### Key Frontend Patterns

- All pages are `"use client"` components that fetch data client-side via `src/lib/data-loader.ts` or `src/lib/api-client.ts`.
- Every API call has a **demo fallback** -- if the API is unreachable, the UI renders with bundled mock data and shows a `DemoBadge`.
- The app has **bilingual support** (zh/en) via `src/lib/i18n.ts` using React Context. Translation dictionaries are inline.
- Theming uses CSS custom properties (e.g., `var(--accent-blue)`, `var(--bg-card)`, `var(--text-muted)`) defined in `globals.css`.
- The Tailwind config extends colors with `pitch`, `accent` palettes and a `mono` font family.

### Key API Patterns

- `apps/api/app/config.py` defines `Settings` via dataclass + `@lru_cache`. All configuration comes from environment variables.
- `LINEUPCAST_PROVIDER_MODE` controls data source: `mock` (bundled demo), `model` (local TS bridge), `external` (real providers).
- `LINEUPCAST_ADMIN_TOKEN` gates write/admin endpoints via bearer auth in `app/security.py`.
- Routes are declared in `app/main.py` with sub-routers in `app/routes/` (imports, settings, auth, overlays, webhooks).
- In-memory caching with TTL is handled by `app/cache.py` via `CacheHeaderMiddleware`.
- The prediction pipeline calls the TypeScript `@lineupcast/prediction` package via a subprocess bridge (`scripts/run-prediction.mjs`).

### Prediction Model

The core model is **Dixon-Coles (1997)** -- a simplified time-weighted Poisson model. Key details:
- Attack/defence strength parameters (1.0 = league average) with home advantage multiplier (~1.35)
- Low-score correlation correction (rho ~ -0.13) for 0-0, 1-0, 0-1, 1-1 scorelines
- Time decay weighting for recent form vs long-run average
- Player rating adjustments from lineup data (xG, VAEP, discipline features)
- xG-based goal scorer allocation and xB-inspired card risk estimation
- Calibration via MLE parameter fitting, Brier score, log loss, ECE, and reliability curves

### Safety Constraints

- `ENABLE_BETTING_ADVICE` must remain `false` -- this is a commentary tool, not a betting service
- `REQUIRE_DISCLAIMER` enforces disclaimer attachment to all generated scripts
- Scripts are sanitized for forbidden phrases (gambling-adjacent language) via `packages/ai-script/src/forbidden.ts`
- The `@lineupcast/schema` package defines `DataCompletenessInput/Result` which caps prediction confidence when data is missing

## Environment Setup

Copy `.env.example` to `.env`. Key variables:
- `LINEUPCAST_PROVIDER_MODE=mock` for local dev without external APIs
- `LINEUPCAST_ADMIN_TOKEN` for write endpoints (POST/DELETE)
- `FOOTBALL_DATA_API_KEY` for football-data.org integration
- LLM keys (`OPENAI_API_KEY`, `HUGGINGFACE_API_TOKEN`) only needed for AI narration features

## Code Conventions

- **TypeScript**: strict mode, ESM (`"type": "module"`), no `any` without justification
- **Python**: type hints required, Pydantic models for API contracts, ruff for linting
- **Commits**: conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- **Formatting**: Prettier for TS/JSON/MD, ruff for Python
- Packages use `"exports"` field with `dist/` build output; `@lineupcast/schema` is the dependency root
