# LineupCast OS -- Post-Sprint Task List

> Generated 2026-05-07 after the 30-agent commercial-readiness sprint.
> 5 agents are still running (Script Safety, OBS Workflow, CSV Import, Provider Health, Calibration Report).
> This list covers what remains AFTER those agents complete.

---

## P0 -- Critical Blockers (must fix before any public launch)

### 1. Reconcile Dual Database Architecture

- **Priority:** P0
- **Effort:** L
- **Description:** The project has two completely separate database layers that do not talk to each other:
  - `apps/api/app/db.py` -- raw SQLite with custom WAL-mode migrations (6 schema versions). Used by matches, scripts, predictions, prediction_registry, match_briefs, overlay_exports, script_groundings.
  - `apps/api/app/database.py` + `apps/api/app/models.py` -- SQLAlchemy ORM targeting PostgreSQL/SQLite. Used exclusively by `api_config_service.py` for `ApiConfiguration` rows.
  - These two layers create separate database files, have separate migration paths, and cannot join or reference each other. The `providers` table in SQLAlchemy `models.py` is never populated; provider data still comes from `src/mock_data.py`.
- **Dependencies:** None
- **Acceptance criteria:**
  - All data goes through one database engine and one migration system.
  - Either migrate `api_config_service` to use `db.py`, or migrate everything to SQLAlchemy.
  - Alembic migrations cover all tables.
  - No data loss during migration.

### 2. Fix Frontend/API Endpoint Mismatch (Lineup Fetch)

- **Priority:** P0
- **Effort:** S
- **Description:** `apps/web/src/lib/data-loader.ts` line 126 fetches `/api/matches/${matchId}/lineup` (singular) but the API route in `main.py` line 123 is `/api/matches/{match_id}/lineups` (plural). The frontend will always get a 404 from the real API and silently fall back to mock data.
- **Dependencies:** None
- **Acceptance criteria:**
  - Frontend fetch path matches the actual API route.
  - Integration test confirms lineup data flows end-to-end.

### 3. Populate Real Provider Data (Remove Hardcoded Mock Providers)

- **Priority:** P0
- **Effort:** M
- **Description:** `GET /api/providers` in `main.py` line 267-268 reads from `src.mock_data.PROVIDERS`, which is a static list of 5 mock providers. Meanwhile, the SQLAlchemy `providers` table exists but is never used. The provider health, sync, and test endpoints all operate on this mock data. Real data providers (football-data.org, API-Football, etc.) configured via `/api/settings/providers` are completely disconnected from the `/api/providers` endpoints.
- **Dependencies:** Task 1 (unified DB)
- **Acceptance criteria:**
  - `/api/providers` returns data from the database, not mock_data.
  - Provider configurations created via `/api/settings/providers` appear in `/api/providers`.
  - Provider test/sync endpoints work with real configured providers.

### 4. Remove XOR Encryption for API Keys

- **Priority:** P0
- **Effort:** S
- **Description:** `apps/api/app/secrets_util.py` uses a trivially reversible XOR cipher with a hardcoded default key (`"lineupcast-dev-key-not-for-prod"`). The code itself says "For production, use a proper KMS." API keys for football-data.org, OpenAI, Huggingface, etc. are encrypted with this weak scheme. Any attacker with read access to the database can decrypt all stored API keys.
- **Dependencies:** None
- **Acceptance criteria:**
  - Replace XOR with AES-256-GCM or similar authenticated encryption.
  - Derive keys using a proper KDF (e.g., PBKDF2 or Argon2).
  - The `LINEUPCAST_ENCRYPTION_SECRET` env var must be required in non-dev mode.
  - Existing encrypted values must be re-encrypted (migration script).

### 5. CORS Must Not Default to Wildcard in Production

- **Priority:** P0
- **Effort:** S
- **Description:** `config.py` defaults `cors_origins` to `["*"]`. Combined with `allow_credentials="*" not in settings.cors_origins` (which evaluates to `False` when `*` is present), this means credentials are disabled when CORS is wide open, but the wildcard itself is a security issue for any deployment that exposes the API publicly.
- **Dependencies:** None
- **Acceptance criteria:**
  - In non-development environments, `LINEUPCAST_CORS_ORIGINS` must be explicitly set.
  - Startup fails or warns loudly when `cors_origins` contains `*` and `environment != "development"`.

### 6. Integrate Script Safety Agent Output

- **Priority:** P0
- **Effort:** M
- **Description:** The Script Safety agent is adding content safety checks (betting language filters, disclaimers, hallucination guards). Its changes need to be wired into the `generate_script()` and `translate_script()` service functions so that unsafe content is blocked before reaching the client.
- **Dependencies:** Script Safety agent completion
- **Acceptance criteria:**
  - Scripts containing betting advice language are rejected or rewritten.
  - All generated scripts include the disclaimer.
  - Hallucinated statistics are flagged by the grounding system.

---

## P1 -- Important Enhancements (should do within 2 weeks)

### 7. Integrate Provider Health Agent Output

- **Priority:** P1
- **Effort:** M
- **Description:** The Provider Health agent is building health monitoring for external API providers. Its health check logic needs to be connected to the `/readyz` endpoint and the `ReadinessResponse` schema so that operators can see real-time provider status.
- **Dependencies:** Provider Health agent completion, Task 1
- **Acceptance criteria:**
  - `/readyz` reflects real provider health status.
  - Provider freshness timestamps update on successful sync.
  - Degraded providers lower the overall readiness status.

### 8. Integrate Calibration Report Agent Output

- **Priority:** P1
- **Effort:** M
- **Description:** The Calibration Report agent is building ECE, reliability curves, and failure segment analysis. The `/api/models/{model_id}/calibration` endpoint and `CalibrationReport` schema already exist in the API, but the service layer (`services.get_model_calibration_report`) needs to call the real calibration logic instead of returning mock data.
- **Dependencies:** Calibration Report agent completion
- **Acceptance criteria:**
  - Calibration reports use real prediction history (not `_MOCK_HISTORICAL_PREDICTIONS`).
  - ECE and Brier scores are computed from actual outcomes.
  - Failure segments identify real underperforming subsets.

### 9. Integrate OBS Workflow Agent Output

- **Priority:** P1
- **Effort:** M
- **Description:** The OBS Workflow agent is building overlay generation and browser-source integration. The overlay routes already exist (`routes/overlays.py`) but generate placeholder SVGs. The agent's output needs to be connected so overlays contain real match data (lineups, predictions, scores).
- **Dependencies:** OBS Workflow agent completion
- **Acceptance criteria:**
  - Overlay SVGs/HTML contain real match and prediction data.
  - Browser source URLs work in OBS with proper authentication.
  - PNG export produces actual rasterized images (not SVG with a note).

### 10. Integrate CSV Import Agent Output

- **Priority:** P1
- **Effort:** M
- **Description:** The CSV Import agent is enhancing the import pipeline. The import routes (`routes/imports.py`) and service (`csv_import_service.py`) already exist but the imported data needs to flow into the prediction pipeline. Currently, imported lineups and player stats are saved to JSON files but never used for predictions.
- **Dependencies:** CSV Import agent completion, Task 1
- **Acceptance criteria:**
  - Imported lineup data is used when generating predictions for imported matches.
  - Imported player stats feed into the player-rating model.
  - Validation errors are clearly communicated to the frontend.

### 11. End-to-End Integration Test Suite

- **Priority:** P1
- **Effort:** L
- **Description:** There is no integration test that exercises the full pipeline: create match -> import lineups -> generate prediction -> generate script -> generate overlay -> export. The test directory at `apps/api/tests/` appears empty or missing. Unit tests for individual modules exist but cross-module flows are untested.
- **Dependencies:** Tasks 1, 2, 3
- **Acceptance criteria:**
  - Test: create match via import -> verify DB -> generate prediction -> verify registry entry -> generate script -> verify grounding -> generate overlay -> verify export.
  - Test: CSV import -> verify data flows to prediction engine.
  - Test: provider configuration -> test connection -> verify health status.
  - All tests pass in CI.

### 12. Wire Frontend to Real API (Remove Silent Mock Fallback)

- **Priority:** P1
- **Effort:** M
- **Description:** The frontend's `data-loader.ts` silently falls back to hardcoded mock data whenever the API returns an error. This means users never see real API errors. The `isDemo` flag is set but there is no prominent UI indicator that data is mock. This makes it impossible to tell if the system is actually working.
- **Dependencies:** Tasks 2, 3
- **Acceptance criteria:**
  - When the API is available, real data is always used (no silent fallback).
  - When the API is down, a visible error banner appears (not just a small badge).
  - The `DemoBadge` component shows on every page when in demo mode.

### 13. Add Rate Limiting

- **Priority:** P1
- **Effort:** S
- **Description:** No endpoints have rate limiting. The prediction, script generation, and provider test endpoints involve expensive operations (subprocess calls, external HTTP requests). Without rate limiting, a single client can DoS the service.
- **Dependencies:** None
- **Acceptance criteria:**
  - Add `slowapi` or similar rate limiter.
  - Admin endpoints: 10 req/min.
  - Public endpoints: 60 req/min.
  - Rate limit headers (`X-RateLimit-*`) returned to clients.

### 14. Add Request Logging and Observability

- **Priority:** P1
- **Effort:** M
- **Description:** There is no structured request logging, no request-ID propagation, and no metrics endpoint. The only logging is via Python's `logging` module with scattered `logger.warning()` calls. For production, need request tracing, response times, error rates.
- **Dependencies:** None
- **Acceptance criteria:**
  - Every request gets a unique `X-Request-ID` header.
  - Structured JSON logs for all requests (method, path, status, latency).
  - `/metrics` endpoint exposes Prometheus-compatible counters.
  - Subprocess bridge calls (prediction, script, model-card) log latency and success/failure.

---

## P2 -- Nice-to-Have Improvements (can wait)

### 15. Replace Mock Data with Real Data Sources

- **Priority:** P2
- **Effort:** L
- **Description:** `src/mock_data.py` provides all team, player, lineup, and prediction data. The entire prediction pipeline, script generation, and overlay system depend on this mock data. For commercial use, this must be replaced with data from configured providers (football-data.org, API-Football, etc.).
- **Dependencies:** Tasks 1, 3, 7
- **Acceptance criteria:**
  - Matches from real providers appear in `/api/matches`.
  - Lineups are fetched from provider APIs, not mock data.
  - Predictions use real team/player statistics.

### 16. Add Database Backup and Recovery

- **Priority:** P2
- **Effort:** M
- **Description:** The SQLite database (`data/lineupcast.db`) has no backup strategy. The file-based snapshot storage (`data/snapshots/`) is also unprotected. A disk failure or accidental deletion loses all data.
- **Dependencies:** Task 1
- **Acceptance criteria:**
  - Automated daily backups to configurable storage (S3, local path).
  - Backup retention policy (7 daily, 4 weekly).
  - Restore procedure documented and tested.

### 17. Proper User Authentication (OAuth/OIDC)

- **Priority:** P2
- **Effort:** L
- **Description:** The only authentication is dev-login (auto-creates a user with a random token) and a single `LINEUPCAST_ADMIN_TOKEN` bearer token. There is no real user registration, password-based auth, or OAuth integration. The workspace system (`auth.py`) is built but has no real identity provider behind it.
- **Dependencies:** None
- **Acceptance criteria:**
  - Support OAuth2/OIDC providers (Google, GitHub).
  - User registration and login flow.
  - Role-based access control (admin, member, viewer).
  - Session management with refresh tokens.

### 18. Add Pagination to List Endpoints

- **Priority:** P2
- **Effort:** S
- **Description:** Most list endpoints (`/api/matches`, `/api/providers`, `/api/snapshots`, `/api/providers/logs`) return all records with no pagination. As data grows, these will become slow and consume excessive memory.
- **Dependencies:** None
- **Acceptance criteria:**
  - All list endpoints accept `limit` and `offset` query parameters.
  - Response includes `total`, `limit`, `offset`, `hasMore` fields.
  - Default limit of 50, max of 500.

### 19. WebSocket for Real-Time Match Updates

- **Priority:** P2
- **Effort:** L
- **Description:** The frontend polls for data. For live match scenarios, a WebSocket or SSE connection would allow real-time score updates, prediction changes, and script regeneration triggers.
- **Dependencies:** Tasks 3, 15
- **Acceptance criteria:**
  - WebSocket endpoint at `/ws/matches/{match_id}`.
  - Push score updates, prediction changes, and new scripts.
  - Frontend subscribes and updates in real time.

### 20. CI/CD Pipeline

- **Priority:** P2
- **Effort:** M
- **Description:** There is no visible CI/CD configuration (no `.github/workflows/`, no `Jenkinsfile`, no `Makefile` for deployment). The `pnpm test` and `pnpm lint` scripts exist but are not automated.
- **Dependencies:** Task 11
- **Acceptance criteria:**
  - GitHub Actions workflow: lint -> typecheck -> test -> build -> deploy.
  - Separate staging and production environments.
  - Automated Docker image builds and pushes.
  - Database migration runs as part of deployment.

### 21. OpenAPI Documentation and SDK

- **Priority:** P2
- **Effort:** S
- **Description:** FastAPI auto-generates OpenAPI docs at `/docs`, but there is no curated API documentation, no SDK generation, and no developer quickstart guide. For commercial use, developers need clear API docs with examples.
- **Dependencies:** Task 18
- **Acceptance criteria:**
  - Curated OpenAPI spec with descriptions, examples, and error codes.
  - Auto-generated TypeScript and Python SDKs.
  - Developer quickstart guide with curl examples.

### 22. Performance Optimization for Subprocess Bridges

- **Priority:** P2
- **Effort:** M
- **Description:** The prediction, script, and model-card bridges all spawn new Node.js subprocesses for each request (`subprocess.run()`). Each invocation pays the Node.js startup cost (~200-500ms). Under load, this becomes the bottleneck.
- **Dependencies:** None
- **Acceptance criteria:**
  - Implement a long-running Node.js worker process with stdin/stdout JSON-RPC.
  - Or: pre-compile to a single binary with near-zero startup.
  - P95 latency for script generation under 2 seconds.

### 23. Docker Production Image

- **Priority:** P2
- **Effort:** M
- **Description:** The `docker-compose.yml` exists but the API Dockerfile is missing from the worktree. The web service uses a raw `node:20-bookworm-slim` image and runs `pnpm install` at startup, which is slow and not production-appropriate.
- **Dependencies:** Task 20
- **Acceptance criteria:**
  - Multi-stage Dockerfile for API (Python slim, no dev deps).
  - Multi-stage Dockerfile for web (standalone Next.js output).
  - Docker compose works with `docker compose up` for local dev.
  - Production images under 200MB each.

---

## Dependency Graph

```
Task 1 (Unified DB) ─┬─> Task 3 (Real Providers) ──> Task 15 (Real Data)
                      ├─> Task 7 (Provider Health)
                      ├─> Task 10 (CSV Import Flow)
                      ├─> Task 16 (Backups)
                      └─> Task 11 (Integration Tests)

Task 2 (Lineup URL) ──> Task 12 (Frontend Real API)

Task 4 (Encryption) ─── (standalone)

Task 5 (CORS) ────────── (standalone)

Task 6 (Script Safety) ── (standalone, depends on agent)

Task 7 (Provider Health) ── depends on agent + Task 1

Task 8 (Calibration) ── depends on agent

Task 9 (OBS Workflow) ── depends on agent

Task 10 (CSV Import) ── depends on agent + Task 1

Task 13 (Rate Limiting) ── (standalone)

Task 14 (Observability) ── (standalone)
```

---

## Recommended Execution Order

**Week 1 (critical path):**
1. Task 1 -- Reconcile dual database (blocks 5 other tasks)
2. Task 2 -- Fix lineup URL mismatch (quick win)
3. Task 4 -- Replace XOR encryption (security)
4. Task 5 -- Fix CORS defaults (security)
5. Task 6 -- Integrate script safety (if agent done)

**Week 2 (integration):**
6. Task 3 -- Real provider data
7. Tasks 7, 8, 9, 10 -- Integrate remaining agent outputs
8. Task 13 -- Rate limiting

**Week 3 (quality):**
9. Task 11 -- Integration test suite
10. Task 12 -- Wire frontend to real API
11. Task 14 -- Observability

**Week 4+ (polish):**
12. Tasks 15-22 -- Nice-to-have improvements
