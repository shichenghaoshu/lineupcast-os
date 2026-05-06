# Hugging Face Spaces Deployment

The `deploy/huggingface-space` directory contains a Docker Space wrapper that starts a small FastAPI service on port `7860`.

## Files

| File | Purpose |
| --- | --- |
| `deploy/huggingface-space/Dockerfile` | Docker runtime for Hugging Face Spaces. |
| `deploy/huggingface-space/app.py` | Minimal service with `/healthz` and `/readyz`. |
| `deploy/huggingface-space/README.md` | Space metadata and operational notes. |

## Required Port

Hugging Face Docker Spaces expect the app to listen on port `7860`.

```bash
uvicorn app:app --host 0.0.0.0 --port 7860
```

## Environment Variables

Set these in the Space secrets or variables UI as needed:

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | Runtime name, for example `huggingface-space`. |
| `LLM_PROVIDER` | Narration provider selector. |
| `OPENAI_API_KEY` | Key for an OpenAI-compatible endpoint. |
| `OPENAI_BASE_URL` | Base URL for an OpenAI-compatible endpoint. |
| `HUGGINGFACE_API_TOKEN` | Token for Hugging Face model access. |
| `ENABLE_BETTING_ADVICE` | Must remain `false` for public commentary deployments. |
| `REQUIRE_DISCLAIMER` | Keep `true` for generated scripts. |

## Readiness

- `/healthz` returns process liveness.
- `/readyz` returns readiness and key safety configuration.

The Space wrapper is intentionally small. It can be expanded later to proxy the API or host the web build, but the first deployment surface is a reliable health-checked service.
