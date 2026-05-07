# Current Review And Roadmap

Last reviewed: 2026-05-07

Repository head reviewed: `d8d8848` before this maintenance pass.

## Current Version Boundary

LineupCast OS is currently a runnable `0.1.x` pre-match commentary cockpit. It is strongest as a transparent demo and development base:

- Next.js cockpit screens for dashboard, lineup, prediction, scripts, overlays, and data-provider status.
- FastAPI service with health/readiness endpoints and public demo contracts.
- Deterministic TypeScript prediction package covering Dixon-Coles, xG scorer ranking, card risk, player adjustment, Brier/log-loss/calibration, and backtesting helpers.
- Deterministic AI-script package with Chinese, English, and bilingual script templates plus safety validation.
- Mock data remains the only fully complete end-to-end data path.

It is not yet production-grade football forecasting infrastructure. Production use still needs authenticated operations, persistent storage, live provider completeness, calibrated historical reports, and a prediction registry.

## Maintenance Fixes In This Pass

- Fixed the Next.js production build failure by wrapping the global sidebar search-param consumer in a Suspense boundary.
- Added a local web fallback when both script API endpoints fail, so script generation no longer throws directly into the UI path.
- Aligned the frontend script request with the API contract by sending `tone`, and added backend `style` / `duration` support.
- Fixed `@lineupcast/ai-script` ESM barrel exports so compiled Node imports resolve correctly.
- Added and exported a bridge-safe `predictMatch()` wrapper for the API prediction subprocess.
- Hardened default CORS behavior so wildcard origins do not also allow browser credentials.
- Added provider capability/status metadata and capability-aware registry filtering.
- Added optional `LINEUPCAST_ADMIN_TOKEN` protection for write/admin POST endpoints while preserving open local demo mode when unset.
- Updated the API Docker image and compose build context so containerized API builds include Node and compiled TypeScript bridge packages.
- Added CI smoke coverage for bridge scripts and API Docker image startup.

## Code Review Findings

### High Priority

1. The real data layer is incomplete. `MockProvider` is the only provider that supports the full cockpit contract. Live providers still lack enough form, H2H, lineup, stats, and prediction inputs to power the full prediction workflow.
2. API state is in module-level dictionaries for matches and scripts. This is acceptable for demo mode, but it loses data on restart and diverges under multi-worker deployment.
3. Calibration reports are not yet release-grade. The backtest utilities exist, but league/season data snapshots and per-class calibration reports are still needed.

### Medium Priority

1. OpenFootball defaults to a fixed season path. Season should be configurable and failures should surface as provider status instead of silent empty lists.
2. LLM provider fallbacks are intentionally resilient, but callers must surface `fallback: true` as degraded state instead of treating fallback content as a normal provider success.
3. Frontend API types and backend Pydantic schemas are still manually duplicated. Shared contract generation would prevent drift like `style` versus `tone`.
4. Overlay export is still closer to a renderer contract than a polished operator workflow. Scene selection, copyable absolute OBS URLs, and real PNG rendering remain open.
5. Docker bridge runtime is now covered in CI, but local Docker validation still depends on a running Docker daemon.

## Roadmap

### Near Term

- Add provider freshness metadata and expose it in API readiness/UI status.
- Make provider failures visible in the data page and API readiness output.
- Add retry/fixture-based Docker smoke tests for local developer workflows.
- Replace remaining hard-coded mock reads in dashboard/lineup/overlay screens with API-backed loaders and explicit demo badges.

### Mid Term

- Build one complete live provider path end to end, starting with fixtures, squads, form, H2H, and stats.
- Store historical match snapshots by provider, league, and season.
- Fit Dixon-Coles parameters from historical data instead of relying only on heuristic lineup strength.
- Publish model cards tied to data snapshots, Brier score, log loss, ECE, and known failure segments.
- Add grounding reports for scripts so each commentary sentence can trace back to specific input fields.
- Add persistent storage for imported matches, generated scripts, provider runs, and prediction records.

### Long Term

- Add a prediction registry with model version, data version, provider freshness, missing fields, inputs, outputs, and explanations.
- Add drift monitoring by league, season, team-strength bucket, home/away split, and provider.
- Support timed pre-match refreshes at T-48h, T-24h, and T-1h for availability, lineups, referee, weather, and market priors where licensed.
- Introduce a transparent ensemble layer across Dixon-Coles, Elo/xG form, market-implied baselines, and player availability adjustments.
- Turn the cockpit into a production commentary workflow with editable rundown, script approvals, overlay queues, and clear "not betting advice" safety boundaries.
