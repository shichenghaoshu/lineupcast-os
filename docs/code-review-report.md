# LineupCast OS -- Comprehensive Code Review Report

**Date:** 2026-05-06
**Reviewer:** Automated Code Review
**Scope:** Full codebase (apps/api, apps/web, packages/*, infrastructure)

---

## Executive Summary

LineupCast OS is a well-structured monorepo implementing a football pre-match commentary data cockpit. The architecture cleanly separates concerns: deterministic prediction algorithms (TypeScript packages), a FastAPI backend, and a Next.js frontend. The codebase shows strong engineering discipline -- clear interfaces, consistent naming, and a thoughtful safety-first approach to AI narration.

**Key strengths:**
- Clean monorepo architecture with proper workspace configuration
- Deterministic prediction engine with auditable math (Dixon-Coles, Poisson, xB)
- Excellent safety layer in the AI script package (forbidden phrases, probability validation)
- Comprehensive contract tests for the API
- Well-designed multi-language script generation (zh/en/bilingual)
- Good defensive coding in bridge implementations (subprocess timeout, fallback chains)

**Key risks:**
- All production data is mock/in-memory -- no persistence layer
- No API rate limiting; bridge subprocesses are expensive per-request
- Login/auth UI is non-functional (cosmetic only)
- Several duplicate model definitions across Python files
- `dist/` directories committed to git

---

## High Priority Issues

### H1. No API Rate Limiting (Performance / DoS Risk)

**File:** `apps/api/app/main.py`

The FastAPI application has no rate limiting middleware. Every request to `/api/matches/{id}/predict` or `/api/matches/{id}/scripts/generate` spawns a Node.js subprocess (via `prediction_bridge.py` and `script_bridge.py`), which is expensive. A malicious or misbehaving client could exhaust server resources.

**Recommendation:** Add `slowapi` or a custom middleware to rate-limit POST endpoints. At minimum, limit bridge-calling endpoints to 10-20 requests per minute per IP.

### H2. In-Memory State -- No Persistence (Data Loss Risk)

**File:** `apps/api/app/services.py`, lines 50-51

```python
MATCHES: dict[str, dict] = {MATCH_DEMO["matchId"]: MATCH_DEMO.copy()}
SCRIPTS: dict[str, ScriptResponse] = {}
```

All match imports and generated scripts exist only in process memory. Server restarts lose all data. Multiple workers (e.g., gunicorn with >1 worker) will have inconsistent state.

**Recommendation:** For the current demo phase, document this limitation prominently. For production, add SQLite or PostgreSQL backing. The README already mentions PostgreSQL 16 in the tech stack but it is not used anywhere.

### H3. Duplicate Pydantic Model Definitions

**Files:** `apps/api/src/models.py` and `apps/api/app/schemas.py`

Both files define `Player`, `Team`, `TeamDetail`, `MatchSummary`, `ModelInfo`, `GoalScorer`, `CardRisk`, `OverlayZone`, `OverlayLayout`, `Provider`, `HealthResponse`. The `schemas.py` version is more complete (has `playerId`, `teamId` fields) and is what the API actually uses. The `models.py` version appears to be a leftover from an earlier iteration.

**Recommendation:** Delete `apps/api/src/models.py` or consolidate into a single source of truth. Having two definitions invites bugs when they drift apart.

### H4. Login Page Is Non-Functional (UX / Security Misleading)

**File:** `apps/web/src/app/login/page.tsx`

The login page renders GitHub login, email login, and local demo buttons, but none of them do anything. There is no authentication system, no session management, no OAuth integration. This could mislead users into thinking the application has authentication.

**Recommendation:** Either implement a minimal auth flow or clearly label this as a "coming soon" placeholder. Add a note that the current deployment is unauthenticated.

### H5. Hardcoded Backtest and Evaluation Metrics

**File:** `apps/api/app/services.py`, lines 245-253, 543-551

```python
def backtest_prediction(match_id: str) -> BacktestResponse:
    return BacktestResponse(
        sampleSize=240,
        accuracy=0.68,
        brierScore=0.19,
        ...
    )
```

All model evaluation, backtest, and calibration endpoints return identical hardcoded metrics regardless of model or match. Users may mistake these for real performance data.

**Recommendation:** Either compute real metrics using the evaluation utilities in `packages/prediction/evaluation/` or return a clear disclaimer in the response that these are placeholder values.

### H6. `lru_cache` on Settings Prevents Runtime Config Changes

**File:** `apps/api/app/config.py`, line 30-32

```python
@lru_cache
def get_settings() -> Settings:
    return Settings()
```

Once cached, environment variable changes (e.g., via Docker restart) require the process to restart. The test suite correctly calls `get_settings.cache_clear()` in `test_admin_token_auth`, but this pattern can surprise operators.

**Recommendation:** Document this behavior. Consider using `functools.cache` with a TTL or removing the cache entirely since Settings construction is cheap.

---

## Medium Priority Issues

### M1. No Database Despite README Claiming PostgreSQL

**File:** `README.md`, line 22

The tech stack table lists "PostgreSQL 16" but no database is configured, no migrations exist, and all data is in-memory mock data.

**Recommendation:** Update the README to accurately reflect the current state (in-memory mock) or add "planned" status. The `docs/current-review-and-roadmap.md` likely covers this, but the README should not mislead.

### M2. Dashboard Page Uses Only Hardcoded Mock Data

**File:** `apps/web/src/app/dashboard/page.tsx`

The dashboard imports all data from `@/lib/mock-data` and never calls the API. Unlike the prediction and script pages which attempt API calls with fallback, the dashboard is entirely static.

**Recommendation:** Wire the dashboard to `getDemoMatch()` and `getPrediction()` from the API client, with fallback to mock data, consistent with the prediction page pattern.

### M3. Formation Switcher Is Cosmetic Only

**File:** `apps/web/src/app/lineup/page.tsx`, lines 34-47

The formation selector (4-2-3-1 / 4-3-3) only changes the label text. Player positions are not recalculated -- the same `manchesterRedXI` array is rendered regardless of selection.

**Recommendation:** Implement position mapping per formation, or remove the switcher until it functions correctly. A non-functional UI element undermines user trust.

### M4. Overlay Export Buttons Are Non-Functional

**File:** `apps/web/src/app/overlay/page.tsx`, lines 69-81

The "Export PNG (16:9)", "Export SVG", and "Export All Scenes" buttons have `onClick` handlers that do nothing. The `overlay-export.ts` utility exists with real implementations but is not wired up.

**Recommendation:** Connect the export buttons to the `downloadPng`, `downloadSvg`, and related functions from `@/lib/overlay-export`.

### M5. Tailwind Dynamic Class Generation Risk

**File:** `apps/web/src/app/players/[id]/page.tsx`, line 245

```tsx
<stat.icon className={`mx-auto h-4 w-4 text-[var(--accent-${stat.color})]`} />
```

Tailwind CSS cannot detect dynamically constructed class names at build time. While this works because it uses CSS custom properties (not Tailwind color utilities), it breaks the Tailwind purging contract and could fail if the pattern changes.

**Recommendation:** Use inline `style` props for dynamic colors, or use a mapping object:
```tsx
const colorMap = { green: "var(--accent-green)", blue: "var(--accent-blue)", ... };
```

### M6. `confidence` Normalization Produces Inconsistent Scales

**File:** `apps/web/src/lib/api-client.ts`, lines 365-367

```typescript
function normalizeConfidence(confidence: number): number {
  return confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
}
```

The API returns `confidence` as a float (0-1). The frontend normalizes it to 0-100 for display. However, the mock data in `mock-data.ts` already has `confidence: 72` (pre-multiplied). If the API returns 0.72, it becomes 72. If it returns 72, it stays 72. This heuristic works but is fragile.

**Recommendation:** Enforce a single convention (0-1 float) across the entire stack and normalize only at the display layer.

### M7. `dist/` Directories Committed to Git

**Files:** All `packages/*/dist/` directories

Compiled JavaScript output is committed to the repository. This bloats the repo, creates merge conflicts, and risks stale build artifacts being served.

**Recommendation:** Add `dist/` to `.gitignore` (it already is at root level) and remove the committed dist directories. Use CI builds or `prepublishOnly` scripts instead.

### M8. Player Page Uses Only Mock Data for Player Lookup

**File:** `apps/web/src/app/players/[id]/page.tsx`, line 36

```typescript
const player = manchesterRedXI.find((p) => p.id === params.id);
```

Player lookup is entirely from the hardcoded mock array. There is no API call to fetch player data.

**Recommendation:** Add a `getPlayer(playerId)` function to the API client and attempt to fetch from the API with mock fallback.

### M9. No React Error Boundaries

**File:** `apps/web/src/app/layout.tsx`

No error boundary components exist. If any component throws during rendering, the entire page crashes with no recovery path.

**Recommendation:** Add an `error.tsx` file at the app directory level (Next.js App Router convention) and consider component-level error boundaries for data-heavy sections.

### M10. Overlay API Route Renders Empty SVG

**File:** `apps/web/src/app/api/overlay/[match_id]/route.ts`, line 33

```typescript
const svg = renderer({ matchId: match_id });
```

The overlay renderers receive only `{ matchId }` with no actual match data (lineups, predictions, teams). The SVG will render with undefined/empty values.

**Recommendation:** Fetch match data from the API within the route handler, or require scene data as query parameters.

### M11. OpenFootball Provider URL Construction Is Fragile

**File:** `packages/providers/src/adapters.ts`, lines 273-275

```typescript
const season = "2025-26";
const leagueFile = league.replace("-", ".");
const url = `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${leagueFile}.1.json`;
```

The season is hardcoded. The league-to-filename mapping assumes a specific naming convention that may not match OpenFootball's actual repository structure.

**Recommendation:** Make the season configurable via environment variable or provider option. Add error handling for 404 responses from the raw GitHub URL.

---

## Low Priority Issues

### L1. Inconsistent Mock Data Between Python and TypeScript

**Files:** `apps/api/src/mock_data.py` vs `apps/web/src/lib/mock-data.ts`

Player stats differ between the two mock datasets. For example, "V. Finish" has `recentRating: 8.1` in the Python mock but `7.7` in the TypeScript mock. Nationalities also differ (e.g., "Uruguay" vs "URU", "Portugal" vs "POR").

**Recommendation:** Consolidate mock data into a single source (e.g., a shared JSON file) or document that the two are intentionally independent.

### L2. `.DS_Store` Committed to Repository

**File:** `.DS_Store` (root)

macOS metadata file is committed. While `.gitignore` does not list `.DS_Store`, it should.

**Recommendation:** Add `.DS_Store` to `.gitignore` and remove from tracking: `git rm --cached .DS_Store`.

### L3. No Test IDs for E2E Testing

**Files:** All `apps/web/src/components/*.tsx`

No `data-testid` attributes on interactive elements. This makes E2E testing with tools like Playwright or Cypress brittle.

**Recommendation:** Add `data-testid` to key interactive elements (buttons, form inputs, navigation links).

### L4. Redundant `redRisk` / `redCardRisk` Fields

**Files:** `apps/api/app/services.py` lines 188-194, `apps/api/app/schemas.py` line 132-133

The `CardRisk` schema has both `redRisk` and `redCardRisk` as `Literal["low", "medium", "high"]`. The service layer maps both to the same value. This redundancy adds confusion.

**Recommendation:** Keep only `redCardRisk` (the more descriptive name) and deprecate `redRisk`.

### L5. Chinese-Only UI Text Without i18n Framework

**Files:** `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/lineup/page.tsx`, `apps/web/src/app/overlay/page.tsx`, etc.

Most pages have hardcoded Chinese text (e.g., "数据驾驶舱", "阵容战术板", "AI 口播稿") without any internationalization framework. The prediction and script pages implement manual bilingual support, but other pages do not.

**Recommendation:** Either adopt an i18n library (next-intl, react-i18next) or document that the UI is intentionally Chinese-primary with selective bilingual support.

### L6. Missing `key` Prop Stability in Lists

**File:** `apps/web/src/app/prediction/page.tsx`, line 156

```tsx
{prediction.models.map((model) => (
  <div key={model.name} ...>
```

Using `model.name` as a key is acceptable here since model names are unique in this context, but if models could have duplicate names, this would cause rendering bugs.

### L7. CI Does Not Run Python Tests

**File:** `.github/workflows/ci.yml`

The `api-smoke` job only checks that the module imports. The actual pytest test suite (`tests/test_contract.py`, `src/tests/test_api.py`) is not run in CI.

**Recommendation:** Add a CI step:
```yaml
- name: Run API tests
  working-directory: apps/api
  run: pip install pytest pytest-asyncio httpx && python -m pytest
```

### L8. Script Bridge Input Mismatch

**File:** `apps/api/app/services.py`, line 345

The `_build_script_input` function passes `raw_prediction.get("homeWin", 50) / 100` to convert percentages to decimals. However, when using the mock fallback (not the bridge), `PREDICTION["homeWin"]` is already `48` (integer percentage). The division by 100 produces `0.48`, which is correct for the TypeScript package. But if the bridge returns values already as decimals, this would double-divide.

**Recommendation:** Standardize on a single representation (0-1 float) throughout the stack and convert only at display boundaries.

### L9. `html lang="zh-CN"` Hardcoded

**File:** `apps/web/src/app/layout.tsx`, line 17

The HTML lang attribute is hardcoded to `zh-CN`. This is incorrect for English-language content and hurts accessibility/SEO for non-Chinese users.

**Recommendation:** Make the lang attribute dynamic based on the selected language, or use `lang="en"` as a neutral default.

### L10. Web Package Missing `@lineupcast/prediction` Dependency

**File:** `apps/web/package.json`

The web app depends on `@lineupcast/schema` and `@lineupcast/overlay-renderer` but not `@lineupcast/prediction`. The prediction page uses the API client which calls the backend, so this is architecturally correct, but the overlay export could benefit from direct access to prediction types.

### L11. Missing `providers/vitest.config.ts` Consistency

**Files:** `packages/providers/vitest.config.ts` and `packages/schema/vitest.config.ts` exist, but `packages/prediction`, `packages/ai-script`, `packages/overlay-renderer`, and `packages/hf` do not have explicit vitest configs (they rely on defaults).

**Recommendation:** Standardize vitest configuration across all packages or document the default configuration approach.

### L12. Docker Compose Web Service Uses `node:20-bookworm-slim` Image

**File:** `docker-compose.yml`, line 25

The web service uses a generic Node image and runs `pnpm install` at startup. This is slow and not reproducible (dependencies change between runs).

**Recommendation:** Add a Dockerfile for the web service (similar to the API's multi-stage build) for reproducible deployments.

---

## Architecture Observations

### Positive Patterns

1. **Bridge pattern for Python-to-TypeScript interop:** The `prediction_bridge.py` and `script_bridge.py` cleanly isolate the subprocess communication with proper timeout handling, stderr logging, and graceful fallback.

2. **Forbidden phrase safety layer:** The `packages/ai-script/src/forbidden.ts` module implements a robust safety system that prevents absolute claims in generated scripts, validates probability consistency, and ensures model citations.

3. **Provider abstraction with rate limiting:** The `packages/providers/` package implements a clean adapter pattern with per-provider rate limiters and a freshness tracker.

4. **Evaluation utilities:** The `packages/prediction/evaluation/` directory contains proper Brier score, log loss, calibration, and backtest implementations -- ready for when real data is available.

5. **Multi-stage Docker build:** The API Dockerfile correctly separates TypeScript compilation from the Python runtime, minimizing the final image size.

### Concerns

1. **No shared mock data source:** Python and TypeScript maintain separate mock datasets that will inevitably drift. Consider a shared JSON fixture.

2. **Provider adapters are mostly placeholders:** Of 6 registered providers, only `FootballDataOrgProvider`, `OpenFootballProvider`, and `ApiFootballProvider` have real implementations. The rest throw "not implemented" errors.

3. **No monitoring or observability:** No structured logging, no metrics endpoints, no request tracing. The `LOG_LLM_PROMPTS` env var exists but is not wired up.

---

## Recommendations for Next Steps

### Immediate (Sprint 1)

1. **Add API rate limiting** on bridge-calling endpoints (H1)
2. **Remove duplicate models.py** (H3)
3. **Fix `.gitignore`** -- add `.DS_Store`, verify `dist/` exclusion (L2, M7)
4. **Run Python tests in CI** (L7)
5. **Mark login page as placeholder** (H4)

### Short-term (Sprint 2-3)

1. **Add SQLite persistence** for matches and scripts (H2)
2. **Wire dashboard to API** with mock fallback (M2)
3. **Fix or remove formation switcher** (M3)
4. **Wire overlay export buttons** (M4)
5. **Standardize confidence representation** across stack (M6, L8)

### Medium-term (Month 2)

1. **Implement one complete live provider path** (currently roadmap item)
2. **Add error boundaries** to the web app (M9)
3. **Adopt i18n framework** or document language strategy (L5)
4. **Add structured logging** and request tracing
5. **Compute real evaluation metrics** from the prediction evaluation utilities (H5)

### Long-term (Quarter 2)

1. **Add authentication system** (replace cosmetic login page)
2. **Add PostgreSQL** for production persistence
3. **Publish calibration reports** by league and season
4. **Add E2E test suite** with Playwright
5. **Performance profiling** for the Dixon-Coles score matrix computation under high maxGoals values

---

## Test Coverage Summary

| Component | Tests Present | Coverage Assessment |
|-----------|:---:|---|
| `apps/api` (contract tests) | Yes | Good -- covers all major endpoints, auth flow |
| `apps/api` (unit tests) | Yes | Basic -- health, matches, players, prediction, script, overlay, providers |
| `apps/web` (api-client) | Yes | Good -- fallback chains, URL construction |
| `apps/web` (components) | No | Missing -- no component-level tests |
| `packages/prediction` | Yes | Good -- algorithm layer and prediction tests |
| `packages/ai-script` | Yes | Good -- script generation tests |
| `packages/providers` | Yes | Basic -- mock provider and registry tests |
| `packages/schema` | Yes | Basic -- field-map-utils tests |
| `packages/overlay-renderer` | Yes | Basic -- overlay renderer tests |
| `packages/hf` | Yes | Basic -- hfClient tests |

---

*End of review.*
