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
| `LINEUPCAST_PROVIDER_MODE` | `mock` | `mock`, `model`, or `external`; `model` enables the local TypeScript prediction bridge, while `external` readiness requires an API key. |
| `LINEUPCAST_PROVIDER_API_KEY` | unset | Readiness flag for external provider mode. |
| `LINEUPCAST_ADMIN_TOKEN` | unset | Optional bearer token required by write/admin POST endpoints when set. |
| `LINEUPCAST_PREDICTION_MODEL_NAME` | `Dixon-Coles + Player Rating Adjustment` | Prediction model display name. |
| `LINEUPCAST_PREDICTION_MODEL_VERSION` | `1.0.0` | Prediction model version. |
| `LINEUPCAST_SCRIPT_MODEL_NAME` | `LineupCast Scriptwriter` | Script model display name. |
| `LINEUPCAST_SCRIPT_MODEL_VERSION` | `1.1.0` | Script model version. |

## Docker

The Dockerfile uses a multi-stage build: the first stage compiles the TypeScript bridge packages (`@lineupcast/prediction`, `@lineupcast/ai-script`), and the second stage copies the Node binary and built `dist/` into the Python runtime. The build context must be the repository root:

```bash
# From repo root
docker build -f apps/api/Dockerfile -t lineupcast-api .
docker run --rm -p 8000:8000 lineupcast-api
```

The container includes Node.js so the Python-to-TypeScript bridge scripts (`scripts/predict.mjs`, `scripts/generate-script.mjs`) work at runtime. Set `LINEUPCAST_PROVIDER_MODE=model` to enable live predictions via the bridge.

## Tests

```bash
cd apps/api
pytest
python -m compileall app src
```
