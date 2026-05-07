# Security Guide

> For commentary assistance, not betting advice.

This document covers security architecture, API key management, authentication modes, workspace isolation, audit logging, and disclaimer enforcement in LineupCast OS.

---

## Table of Contents

1. [API Key Storage](#api-key-storage)
2. [Authentication Modes](#authentication-modes)
3. [Workspace Isolation](#workspace-isolation)
4. [Audit Logging](#audit-logging)
5. [Disclaimer Requirements](#disclaimer-requirements)
6. [Safety Flags Reference](#safety-flags-reference)
7. [Security Checklist](#security-checklist)

---

## API Key Storage

### Storage Methods

LineupCast OS supports two methods for storing API keys:

| Method | Encryption at Rest | Masked in API | Survives Restart | Multi-Instance |
|--------|-------------------|---------------|------------------|----------------|
| Environment variables | Depends on OS/host | No (raw in process) | Yes | Per-instance |
| Database config (V0.2+) | Yes (AES-256) | Yes (`***abc1`) | Yes | Shared |

### Encrypted Storage

When stored via the API Configuration Center (V0.2+), all API keys are encrypted at rest using AES-256-GCM. The encryption key is derived from `LINEUPCAST_ENCRYPTION_KEY` environment variable.

```bash
# Set the encryption key (required for database-stored config)
LINEUPCAST_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

### Masked Display

When configuration is read via the API, sensitive values are masked:

```json
{
  "football_data_api_key": {
    "configured": true,
    "masked": "***a1b2",
    "lastRotated": "2026-05-01T00:00:00Z"
  }
}
```

The full key is never returned in API responses. Only the last 4 characters are shown.

### Key Rotation

Rotate API keys on a regular schedule (recommended: every 90 days).

```bash
# Update a provider key
curl -X PUT http://localhost:8000/api/config/provider/football-data \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "new-key-value"}'
```

The old key is immediately replaced. No restart required for database-stored keys.

### What is Stored Where

| Key Type | Storage Location | Notes |
|----------|-----------------|-------|
| `FOOTBALL_DATA_API_KEY` | Env var or DB | Football data provider |
| `HUGGINGFACE_API_TOKEN` | Env var or DB | Hugging Face access |
| `HUGGINGFACE_ENDPOINT_TOKEN` | Env var or DB | Dedicated HF endpoint |
| `OPENAI_API_KEY` | Env var or DB | LLM narration |
| `LINEUPCAST_ADMIN_TOKEN` | Env var only | Admin auth (never in DB) |
| `LINEUPCAST_ENCRYPTION_KEY` | Env var only | DB encryption key (never in DB) |

**Critical:** `LINEUPCAST_ADMIN_TOKEN` and `LINEUPCAST_ENCRYPTION_KEY` are never stored in the database. They exist only as environment variables.

---

## Authentication Modes

### Mode 1: No Authentication (Local Development)

When `LINEUPCAST_ADMIN_TOKEN` is not set, all endpoints are open. This is the default for local development.

```bash
# No token required
curl http://localhost:8000/api/matches/demo
```

**Use only in local development. Never deploy to production without setting an admin token.**

### Mode 2: Admin Token (V0.1-V0.3)

A single shared token protects write/admin endpoints. Read endpoints remain open.

```bash
# Set the token
LINEUPCAST_ADMIN_TOKEN=$(openssl rand -hex 32)

# Write endpoints require the token
curl -X POST http://localhost:8000/api/imports/lineups \
  -H "X-Admin-Key: $LINEUPCAST_ADMIN_TOKEN" \
  -F "file=@lineup.csv"

# Read endpoints work without the token
curl http://localhost:8000/api/matches/demo
```

**Endpoints requiring admin token:**

| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| POST | `/api/imports/*` | Yes |
| PUT | `/api/config/*` | Yes |
| DELETE | `/api/config/*` | Yes |
| POST | `/api/matches/*/script` | No (read-like) |
| GET | `/api/matches/*` | No |
| GET | `/api/providers` | No |
| GET | `/health` | No |

### Mode 3: Full Auth with Workspaces (V0.4+)

Per-workspace API keys with role-based access control.

**Roles:**

| Role | Read | Write Predictions | Import Data | Manage Config | Manage Workspace |
|------|------|-------------------|-------------|---------------|-----------------|
| viewer | Yes | No | No | No | No |
| editor | Yes | Yes | Yes | No | No |
| admin | Yes | Yes | Yes | Yes | Yes |

**API key format:** `lcws_{workspace_id}_{random}`

```bash
# Use a workspace API key
curl http://localhost:8000/api/matches/match-001/prediction \
  -H "Authorization: Bearer lcws_abc123_def456"
```

---

## Workspace Isolation

Starting with V0.4, LineupCast supports multi-tenant workspace isolation.

### How Isolation Works

Each workspace has:

- **Own providers:** API keys are scoped per workspace.
- **Own predictions:** Predictions generated in one workspace are not visible to others.
- **Own scripts:** Generated scripts are workspace-scoped.
- **Own imports:** CSV imports are scoped to the importing workspace.

### Data Boundaries

```
Workspace A                    Workspace B
  ├── Providers                 ├── Providers
  │   ├── football-data.org     │   ├── football-data.org
  │   └── CSV import            │   └── OpenFootball
  ├── Matches                   ├── Matches
  │   ├── match-001             │   ├── match-101
  │   └── match-002             │   └── match-102
  ├── Predictions               ├── Predictions
  └── Scripts                   └── Scripts
```

No data crosses workspace boundaries. API queries are automatically scoped to the authenticated workspace.

### Enforcement

- Database queries include a `WHERE workspace_id = ?` clause on all data tables.
- API middleware extracts workspace from the API key and injects it into the request context.
- Cross-workspace access returns `404 Not Found` (not `403 Forbidden`, to prevent enumeration).

---

## Audit Logging

### What is Logged

All write operations are logged with:

- **Timestamp** (ISO 8601, UTC)
- **Actor** (workspace ID, API key suffix, or "system")
- **Action** (e.g., `import.lineups`, `config.update`, `prediction.create`)
- **Resource** (e.g., match ID, provider ID)
- **Result** (success or failure)
- **IP address** (if available)

### Log Format

```json
{
  "timestamp": "2026-05-07T10:30:00Z",
  "actor": "workspace:abc123 key:***def4",
  "action": "import.lineups",
  "resource": "match:demo-match-001",
  "result": "success",
  "details": {
    "rowsImported": 22,
    "fileSizeBytes": 4096
  },
  "ip": "192.168.1.100"
}
```

### Log Access

```bash
# Query audit logs (admin only)
curl http://localhost:8000/api/audit/logs \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"action": "import.*", "since": "2026-05-01"}'
```

### Log Retention

| Environment | Retention Period |
|-------------|-----------------|
| Development | 7 days |
| Staging | 30 days |
| Production | 1 year |

### What is NOT Logged

- API key values (only masked suffixes)
- LLM prompt contents (unless `LOG_LLM_PROMPTS=true`, development only)
- Prediction inputs/outputs (stored separately in prediction registry, not in audit log)

---

## Disclaimer Requirements

### Mandatory Disclaimer

Every generated script must include the disclaimer:

```text
Models calculate. AI narrates. For commentary assistance, not betting advice.
```

### Enforcement

1. **Environment variable:** `REQUIRE_DISCLAIMER=true` (default). When true, the script generation pipeline appends the disclaimer to every output.
2. **Validation:** The script safety validator checks for disclaimer presence before returning the response. If the disclaimer is missing, the response is rejected.
3. **API response:** The disclaimer is included in the `disclaimer` field of every script response.

### Prohibited Content

The `ENABLE_BETTING_ADVICE` flag (must remain `false` in all production deployments) triggers content filtering:

- No language suggesting betting on outcomes.
- No odds recommendations.
- No "guaranteed" or "certain" language about predictions.
- No financial advice framing.

### Response Contract

Every script response includes:

```json
{
  "headline": "Match Preview: Team A vs Team B",
  "key_points": ["..."],
  "bilingual_script": { "en": "...", "zh": "..." },
  "risk_notes": ["..."],
  "disclaimer": "Models calculate. AI narrates. For commentary assistance, not betting advice."
}
```

The `disclaimer` field is always present. If `REQUIRE_DISCLAIMER=true` and the field is empty, the API returns an error.

---

## Safety Flags Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_AI_NARRATION` | `true` | Enables AI script generation. Set to `false` to disable all LLM calls. |
| `ENABLE_BETTING_ADVICE` | `false` | **Must remain `false`.** Enables content filtering against betting language. |
| `REQUIRE_DISCLAIMER` | `true` | Requires disclaimer in all generated scripts. |
| `ALLOW_SYNTHETIC_DATA` | `true` | Allows mock/demo data. Set to `false` in production to prevent stale demo data from being served. |
| `LOG_LLM_PROMPTS` | `false` | Logs LLM prompts for debugging. **Set to `false` in production.** |

### Production Safety Settings

```bash
# Recommended production .env
ENABLE_AI_NARRATION=true
ENABLE_BETTING_ADVICE=false
REQUIRE_DISCLAIMER=true
ALLOW_SYNTHETIC_DATA=false
LOG_LLM_PROMPTS=false
```

---

## Security Checklist

### Pre-Deployment

- [ ] `LINEUPCAST_ADMIN_TOKEN` is set with a strong random value (32+ hex characters)
- [ ] `LINEUPCAST_ENCRYPTION_KEY` is set if using database config storage
- [ ] `ENABLE_BETTING_ADVICE=false` confirmed
- [ ] `REQUIRE_DISCLAIMER=true` confirmed
- [ ] `ALLOW_SYNTHETIC_DATA=false` set for production
- [ ] `LOG_LLM_PROMPTS=false` set for production
- [ ] `.env` file is in `.gitignore` and not committed
- [ ] All API keys are valid and tested

### Network

- [ ] HTTPS enabled for all endpoints
- [ ] CORS restricted to known frontend origins (not `*`)
- [ ] Rate limiting enabled (V0.4+)
- [ ] Database not exposed to public internet
- [ ] Admin endpoints not exposed without auth

### Ongoing

- [ ] API keys rotated every 90 days
- [ ] Audit logs reviewed monthly
- [ ] Provider health monitored
- [ ] Disclaimer present in all generated scripts
- [ ] No betting advice language in outputs

---

## Disclaimer

LineupCast OS is an educational and analytical tool for pre-match commentary preparation. It is not a betting service. Predictions are probabilistic estimates based on historical data -- they are not guarantees. Always verify information independently.
