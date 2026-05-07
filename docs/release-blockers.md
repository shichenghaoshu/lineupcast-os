# Release Blockers

Known issues, required manual tests, and deployment prerequisites for LineupCast OS releases.

## Known Issues

### Critical

| Issue | Status | Workaround |
|-------|--------|------------|
| XOR encryption in `secrets_util.py` is not production-grade | Open | Replace with proper KMS (AWS Secrets Manager, HashiCorp Vault) before production launch |
| SQLite default database not suitable for concurrent writes | Open | Migrate to PostgreSQL for production (see `docs/postgresql-migration.md`) |
| `LINEUPCAST_ENCRYPTION_SECRET` defaults to hardcoded dev key | Open | Must set environment variable in production |

### Non-Critical

| Issue | Status | Workaround |
|-------|--------|------------|
| `predict.mjs` and `generate-script.mjs` spawn child processes | Known | Acceptable for current load; consider worker pool at scale |
| CORS defaults to wildcard `*` | Known | Set `LINEUPCAST_CORS_ORIGINS` to specific domains in production |
| No rate limiting on public GET endpoints | Known | Add reverse proxy rate limiting (nginx/Cloudflare) |
| Provider sync runs sequentially | Known | Acceptable for current provider count |

## Required Manual Tests

Before any production deployment, verify these scenarios manually:

### 1. Authentication and Authorization

- [ ] Set `LINEUPCAST_ADMIN_TOKEN` and verify all POST endpoints require Bearer token
- [ ] Verify GET endpoints remain public when admin token is set
- [ ] Verify wrong token returns 401 without leaking token value in response
- [ ] Verify empty Authorization header returns 401

### 2. Prediction Pipeline

- [ ] Generate a prediction for the demo match via `POST /api/matches/{id}/predict`
- [ ] Verify prediction includes: modelName, modelVersion, confidence, explanation, goalScorers, cardRisks
- [ ] Verify prediction is persisted in the registry
- [ ] Run `GET /api/matches/{id}/prediction/explain` and verify factors are returned
- [ ] Run `GET /api/matches/{id}/prediction/backtest` and verify sampleSize > 0

### 3. Script Generation

- [ ] Generate a bilingual script via `POST /api/matches/{id}/scripts/generate`
- [ ] Verify script includes: language, provider, model, latencyMs, fallback flag
- [ ] Translate script to Chinese via `POST /api/scripts/{id}/translate`
- [ ] Verify Node.js bridge processes complete within 15s timeout

### 4. Data Import

- [ ] Import a match via CSV upload
- [ ] Verify imported match appears in `GET /api/matches`
- [ ] Run data completeness check via `GET /api/matches/{id}/data-completeness`

### 5. Provider Management

- [ ] List providers via `GET /api/settings/providers`
- [ ] Create a provider config via `POST /api/settings/providers`
- [ ] Test provider connection via `POST /api/settings/providers/{id}/test`
- [ ] Verify API keys are encrypted at rest (not stored in plaintext)
- [ ] Rotate a provider key via `POST /api/settings/providers/{id}/rotate-key`

### 6. Health and Readiness

- [ ] Verify `GET /healthz` returns `{"status": "ok"}`
- [ ] Verify `GET /readyz` returns model availability and provider mode
- [ ] Verify readiness degrades gracefully when provider is unavailable

### 7. Docker Container

- [ ] Container starts and responds to health check within 30s
- [ ] Container runs as non-root user (verify in Dockerfile)
- [ ] No secrets baked into Docker image layers
- [ ] Container logs do not contain API keys or tokens

## Deployment Prerequisites

### Environment Variables (Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `LINEUPCAST_ADMIN_TOKEN` | Bearer token for admin endpoints | Use `openssl rand -hex 32` |
| `LINEUPCAST_ENCRYPTION_SECRET` | Secret for API key encryption | Use `openssl rand -hex 32` |
| `LINEUPCAST_ENVIRONMENT` | Deployment environment | `production` |
| `LINEUPCAST_CORS_ORIGINS` | Allowed CORS origins | `https://app.lineupcast.com` |
| `LINEUPCAST_DATABASE_URL` | Database connection string | `postgresql://...` |

### Environment Variables (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `LINEUPCAST_PROVIDER_MODE` | Provider mode: mock/model/external | `mock` |
| `LINEUPCAST_PROVIDER_API_KEY` | Default provider API key | None |
| `LINEUPCAST_VERSION` | Application version | `0.1.0` |
| `LINEUPCAST_APP_NAME` | Application name | `LineupCast OS API` |
| `LINEUPCAST_DEV_MODE` | Enable dev features | `false` |

### Infrastructure Requirements

- [ ] PostgreSQL 14+ database provisioned and accessible
- [ ] Node.js 20+ available in container runtime (for bridge scripts)
- [ ] Python 3.11+ runtime
- [ ] Reverse proxy configured with TLS termination
- [ ] Health check endpoint configured at `/healthz` with 30s interval
- [ ] Readiness probe configured at `/readyz`
- [ ] Container memory limit: minimum 512MB
- [ ] Container CPU limit: minimum 0.5 vCPU

### Pre-Deploy Checklist

- [ ] All CI checks pass (lint, typecheck, test, API smoke, bridge smoke, docker build)
- [ ] Docker smoke tests pass (healthz, readyz, settings, matches, providers)
- [ ] Provider contract tests pass
- [ ] Prediction registry tests pass
- [ ] Security audit passes (no hardcoded secrets, admin auth works)
- [ ] Database migrations applied (if any)
- [ ] Environment variables set in deployment platform
- [ ] Rollback plan documented and tested
- [ ] Monitoring and alerting configured

### Post-Deploy Checklist

- [ ] Health check returns 200 within 30s of deploy
- [ ] Readiness check shows `status: ready` or `status: degraded`
- [ ] Demo match prediction generates successfully
- [ ] Provider list endpoint returns configured providers
- [ ] Admin endpoints reject requests without valid token
- [ ] Container logs show no errors in first 5 minutes
- [ ] No memory or CPU alerts within first 15 minutes

## Test Suite Summary

| Test File | Tests | Coverage |
|---|---|---|
| `tests/test_integration.py` | ~30 | Full API endpoint integration: health, readiness, demo match, prediction, script, CSV import, API config CRUD, data completeness, provider list, full pipeline |
| `tests/test_api_config.py` | ~15 | API configuration CRUD, key masking, rotate key, test connection, env fallback, LLM status |
| `tests/test_prediction_registry.py` | ~15 | Prediction input snapshots, audit trail, retrieval by ID and match, immutable records |
| `tests/test_contract.py` | ~6 | API contract validation, CORS, admin token auth |
| `tests/test_csv_import.py` | ~30 | CSV parsing, validation, edge cases, UTF-8 BOM, large files, quoted fields |
| `tests/test_prediction_degraded.py` | ~30 | Data completeness scoring, degraded modes, confidence caps, bridge fallback |
| `src/tests/test_api.py` | ~10 | Core API endpoint smoke tests |
