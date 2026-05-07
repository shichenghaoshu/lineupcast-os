# Commercial Roadmap

> For commentary assistance, not betting advice.

LineupCast OS follows an incremental release strategy. Each version adds production-readiness layers on top of the open-source core. This document defines version boundaries, feature scope, and the feature matrix for each release.

---

## Version Definitions

### V0.2 -- API Configuration Center + CSV Import

**Theme:** Make the system configurable without code changes.

**Scope:**

- API Configuration Center: a web UI and API endpoints to manage provider keys, LLM settings, and safety flags without editing `.env` files.
- CSV Import (completed): bulk import for lineups, player stats, and match history via API endpoints.
- Config persistence in the database so settings survive restarts.
- Per-field validation and masked display for sensitive values.

**Exit Criteria:**

- All provider keys configurable via API and UI.
- CSV import for all three types working end-to-end with validation.
- Settings persist across API restarts.

---

### V0.3 -- Real Provider Integration + Prediction Registry

**Theme:** Move from demo data to live data with full traceability.

**Scope:**

- Real provider integration: football-data.org provider fully wired for fixtures, match detail, recent matches, and standings.
- Prediction Registry: every prediction stored with model version, data version, provider freshness, missing fields, inputs, outputs, and explanations.
- Data completeness scoring integrated into the prediction pipeline with degraded mode.
- Provider health monitoring exposed in API and UI.

**Exit Criteria:**

- At least one real provider powering the full prediction workflow.
- Every prediction queryable with full provenance metadata.
- Provider health visible in the UI and `/readyz` endpoint.

---

### V0.4 -- Workspace + Auth + Production Deployment

**Theme:** Multi-user production readiness.

**Scope:**

- Workspace isolation: each workspace has its own providers, predictions, and scripts.
- Authentication: API key and token-based auth for all write endpoints.
- Role-based access: admin, editor, viewer roles per workspace.
- Production deployment hardening: PostgreSQL required, Docker Compose production profile, health/readiness probes.
- Rate limiting and request logging.

**Exit Criteria:**

- Multiple workspaces can operate independently without data leakage.
- All write endpoints require authentication.
- Production Docker deployment passes smoke tests.

---

### V1.0 -- Commercial Launch

**Theme:** Public-ready product with billing and support.

**Scope:**

- Billing integration: usage tracking per workspace, tier enforcement.
- Self-service signup and workspace creation.
- Documentation site with API reference, tutorials, and examples.
- Calibration reports published per league and season.
- SLA for uptime and support response times.
- Legal: terms of service, privacy policy, disclaimer prominently displayed.

**Exit Criteria:**

- Billing system operational with free and paid tiers.
- Public documentation site live.
- Legal documents reviewed and published.

---

## Feature Matrix

| Feature                          | V0.1 (Current) | V0.2       | V0.3              | V0.4          | V1.0          |
| -------------------------------- | -------------- | ---------- | ----------------- | ------------- | ------------- |
| Mock data / demo mode            | Yes            | Yes        | Yes               | Yes           | Yes           |
| CSV import                       | Yes            | Yes        | Yes               | Yes           | Yes           |
| Dixon-Coles prediction model     | Yes            | Yes        | Yes               | Yes           | Yes           |
| AI script generation             | Yes            | Yes        | Yes               | Yes           | Yes           |
| API configuration center         | --             | Yes        | Yes               | Yes           | Yes           |
| Config persistence (DB)          | --             | Yes        | Yes               | Yes           | Yes           |
| Real provider integration        | Partial        | Partial    | Yes               | Yes           | Yes           |
| Prediction registry              | --             | --         | Yes               | Yes           | Yes           |
| Data completeness scoring        | Yes            | Yes        | Yes (integrated)  | Yes           | Yes           |
| Provider health monitoring       | Yes            | Yes        | Yes               | Yes           | Yes           |
| Workspace isolation              | --             | --         | --                | Yes           | Yes           |
| Authentication / RBAC            | Admin token    | Admin token| Admin token       | Full auth     | Full auth     |
| Rate limiting                    | --             | --         | --                | Yes           | Yes           |
| Billing / usage tracking         | --             | --         | --                | --            | Yes           |
| Calibration reports              | --             | --         | Partial           | Yes           | Yes (published)|
| Public documentation site        | --             | --         | --                | --            | Yes           |
| Terms of service / privacy       | --             | --         | --                | --            | Yes           |

---

## Dependencies Between Versions

```
V0.1 (done) --> V0.2 (config + import) --> V0.3 (real data + registry) --> V0.4 (workspace + auth) --> V1.0 (commercial)
```

Each version is deployable independently. V0.3 does not require V0.2 config UI to function (env vars still work). V0.4 does not require the prediction registry but benefits from it.

---

## Timeline Guidance

| Version | Estimated Duration | Key Risk                           |
| ------- | ------------------ | ---------------------------------- |
| V0.2    | 2-3 weeks          | Config UI scope creep              |
| V0.3    | 3-4 weeks          | Real provider data quality         |
| V0.4    | 4-6 weeks          | Auth complexity, workspace isolation |
| V1.0    | 4-8 weeks          | Billing integration, legal review  |

---

## Disclaimer

LineupCast OS is an educational and analytical tool for pre-match commentary preparation. It is not a betting service. Predictions are probabilistic estimates based on historical data -- they are not guarantees. Always verify information independently.
