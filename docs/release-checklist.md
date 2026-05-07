# Release Checklist

> For commentary assistance, not betting advice.

Use this checklist for every LineupCast OS release. Complete all sections in order. Do not skip steps.

---

## Pre-Release Verification

### Code Quality

- [ ] All tests pass: `pnpm test` (TypeScript) and `pytest` (Python)
- [ ] No TypeScript compilation errors: `pnpm build`
- [ ] No Python type errors: `mypy api/`
- [ ] Linting passes: `pnpm lint`
- [ ] No known security vulnerabilities in dependencies: `pnpm audit` and `pip-audit`
- [ ] All new features have corresponding tests
- [ ] Code review completed by at least one other contributor

### Algorithm Verification

- [ ] Dixon-Coles model outputs are deterministic for the same inputs
- [ ] xG scorer ranking produces consistent results
- [ ] Card risk layer returns categorical values (low/medium/high)
- [ ] Calibration utilities produce valid Brier and log-loss scores
- [ ] Backtest runs against known fixtures without errors
- [ ] Model card updated if algorithm parameters changed

### Data Layer Verification

- [ ] Mock provider returns complete data for demo match
- [ ] CSV import accepts all three formats (lineups, player stats, match history)
- [ ] CSV validation rejects malformed files with clear error messages
- [ ] Data completeness scoring returns correct scores for known inputs
- [ ] Provider health endpoint returns accurate status for configured providers
- [ ] Freshness timestamps are correct and in UTC

---

## Testing Checklist

### Unit Tests

```bash
# TypeScript packages
pnpm test

# Python API
pytest api/tests/ -v
```

- [ ] All TypeScript unit tests pass
- [ ] All Python unit tests pass
- [ ] New test coverage for any added functionality

### Integration Tests

- [ ] API health endpoint responds: `curl http://localhost:8000/health`
- [ ] Readiness endpoint responds: `curl http://localhost:8000/readyz`
- [ ] Demo match endpoint returns valid data: `curl http://localhost:8000/api/matches/demo`
- [ ] Prediction endpoint returns valid output: `curl http://localhost:8000/api/matches/demo/prediction`
- [ ] Script generation works: `curl -X POST http://localhost:8000/api/matches/demo/script`
- [ ] Provider list endpoint returns configured providers: `curl http://localhost:8000/api/providers`
- [ ] CSV import endpoints accept valid files

### End-to-End Tests

- [ ] Web dashboard loads without errors at `http://localhost:3000`
- [ ] Dashboard displays match data from API
- [ ] Prediction screen shows probabilities, xG, and confidence
- [ ] Script generation screen produces output with disclaimer
- [ ] Overlay endpoint returns valid metadata
- [ ] Provider status page shows health indicators
- [ ] Data completeness indicator displays correctly

### Bridge Tests

```bash
# Test the Python-to-TypeScript bridge
node packages/bridge/dist/predict.js '{"homeTeam":"Arsenal","awayTeam":"Chelsea"}'
node packages/bridge/dist/script.js '{"match":"Arsenal vs Chelsea","language":"en"}'
```

- [ ] Bridge prediction script runs without errors
- [ ] Bridge script generation runs without errors
- [ ] Bridge outputs are valid JSON

### Docker Tests

```bash
# Build and run Docker image
docker compose build
docker compose up -d
# Wait for startup
sleep 10
# Verify health
curl http://localhost:8000/health
```

- [ ] Docker image builds successfully
- [ ] Container starts and passes health check
- [ ] API is accessible from host machine
- [ ] Bridge scripts work inside the container

---

## Deployment Checklist

### Environment Configuration

- [ ] `.env` file configured with production values
- [ ] `APP_ENV` set to `production` (or appropriate label)
- [ ] `LINEUPCAST_ADMIN_TOKEN` set with strong random value
- [ ] `LINEUPCAST_ENCRYPTION_KEY` set if using database config
- [ ] `ENABLE_BETTING_ADVICE=false` confirmed
- [ ] `REQUIRE_DISCLAIMER=true` confirmed
- [ ] `ALLOW_SYNTHETIC_DATA=false` set for production (or `true` if demo mode is intended)
- [ ] `LOG_LLM_PROMPTS=false` confirmed
- [ ] All API keys are valid and tested

### Database

- [ ] PostgreSQL 16+ is running and accessible
- [ ] Database migrations applied: `alembic upgrade head`
- [ ] Database connection string is correct in `.env`
- [ ] Database backup scheduled

### Network

- [ ] HTTPS certificate is valid and not expiring soon
- [ ] CORS origins restricted to known frontend domains
- [ ] Firewall rules allow only necessary ports (8000 for API, 3000 for web, 5432 for DB)
- [ ] DNS records point to the correct server
- [ ] Rate limiting configured (V0.4+)

### Services

- [ ] API service is running and passing health checks
- [ ] Web service is running and serving the frontend
- [ ] Database is running and accepting connections
- [ ] All configured providers are healthy: `curl http://localhost:8000/api/providers`
- [ ] LLM provider is reachable and responding (if AI narration enabled)

---

## Post-Release Monitoring

### Immediate (First 30 Minutes)

- [ ] Health endpoint stable: `GET /health` returns `{"status": "ok"}`
- [ ] Readiness endpoint stable: `GET /readyz` returns `{"ready": true}`
- [ ] No error spikes in application logs
- [ ] API response times are within normal range (< 500ms for most endpoints)
- [ ] Provider health shows all configured providers as `healthy` or `degraded`

### First 24 Hours

- [ ] No unhandled exceptions in logs
- [ ] Prediction endpoint returning valid results for real matches
- [ ] Script generation working with configured LLM provider
- [ ] CSV imports completing successfully
- [ ] No database connection pool exhaustion
- [ ] Memory usage stable (no leaks)

### First Week

- [ ] Provider data freshness within expected thresholds
- [ ] Prediction accuracy tracking initiated (compare predictions to actual results)
- [ ] User-reported issues triaged and prioritized
- [ ] Audit logs reviewed for unexpected activity
- [ ] API key rotation reminder set (90 days from release)

### Monitoring Commands

```bash
# Check API health
curl -s http://localhost:8000/health | jq .

# Check readiness with provider details
curl -s http://localhost:8000/readyz | jq .

# Check all providers
curl -s http://localhost:8000/api/providers | jq '.[] | {id, status, lastSuccessfulCall}'

# Check recent predictions
curl -s http://localhost:8000/api/predictions?limit=5 | jq '.[] | {matchId, completeness, timestamp}'

# Check disk usage (log files, database)
df -h
du -sh /var/log/lineupcast/ 2>/dev/null
```

---

## Rollback Plan

If critical issues are discovered after release:

### Step 1: Assess Severity

| Severity | Example | Response Time |
|----------|---------|---------------|
| Critical | API completely down, data loss | Immediate rollback |
| High | Predictions returning wrong results, auth bypass | Rollback within 1 hour |
| Medium | LLM provider failing, slow responses | Fix forward within 24 hours |
| Low | UI cosmetic issue, minor logging gap | Fix in next release |

### Step 2: Rollback Procedure

```bash
# Docker rollback
docker compose down
docker compose up -d --force-recreate previous-image-tag

# Git rollback
git revert HEAD
# Rebuild and redeploy
```

### Step 3: Communication

- [ ] Notify affected users of the issue and expected resolution time
- [ ] Document the root cause in the release notes
- [ ] Create a fix PR with regression test

---

## Release Notes Template

```markdown
## LineupCast OS v0.X.0

### New Features
- [Feature 1]: [Description]
- [Feature 2]: [Description]

### Improvements
- [Improvement 1]: [Description]

### Bug Fixes
- [Fix 1]: [Description]

### Known Issues
- [Issue 1]: [Description and workaround]

### Breaking Changes
- [Change 1]: [Migration steps]

### Migration
- [Steps to upgrade from previous version]
```

---

## Disclaimer

LineupCast OS is an educational and analytical tool for pre-match commentary preparation. It is not a betting service. Predictions are probabilistic estimates based on historical data -- they are not guarantees. Always verify information independently.
