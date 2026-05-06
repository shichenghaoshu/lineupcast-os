# LineupCast API

Deployable FastAPI service for football match data, lineups, deterministic predictions, script generation, model metadata, and provider checks.

## Run Locally

```bash
cd apps/api
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Health and readiness:

```bash
curl http://localhost:8000/healthz
curl http://localhost:8000/readyz
```

OpenAPI is available at `http://localhost:8000/docs` and `http://localhost:8000/openapi.json`.

## Environment

All checks are lightweight and deterministic. `/healthz` does not load models. `/readyz` uses only environment/configuration checks.

| Variable | Default | Purpose |
| --- | --- | --- |
| `LINEUPCAST_VERSION` | `0.1.0` | API version returned by health endpoints. |
| `LINEUPCAST_CORS_ORIGINS` | `*` | Comma-separated CORS origins. |
| `LINEUPCAST_PROVIDER_MODE` | `mock` | `mock` or `external`; external readiness requires an API key. |
| `LINEUPCAST_PROVIDER_API_KEY` | unset | Readiness flag for external provider mode. |
| `LINEUPCAST_PREDICTION_MODEL_NAME` | `LineupCast Ensemble` | Prediction model display name. |
| `LINEUPCAST_PREDICTION_MODEL_VERSION` | `2.4.1` | Prediction model version. |
| `LINEUPCAST_SCRIPT_MODEL_NAME` | `LineupCast Scriptwriter` | Script model display name. |
| `LINEUPCAST_SCRIPT_MODEL_VERSION` | `1.1.0` | Script model version. |

## Docker

```bash
cd apps/api
docker build -t lineupcast-api .
docker run --rm -p 8000:8000 lineupcast-api
```

## Tests

```bash
cd apps/api
pytest
python -m compileall app src
```
