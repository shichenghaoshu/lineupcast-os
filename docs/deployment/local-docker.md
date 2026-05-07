# Local Docker Deployment

The Docker Compose setup builds the API image from the repository root so it can include compiled TypeScript bridge packages alongside the Python service. No PostgreSQL is required by default.

## Prerequisites

- Docker Desktop or a compatible Docker Engine.
- A copy of `.env`, usually created from `.env.example`.

```bash
cp .env.example .env
docker compose up --build
```

## Build Context

The API Dockerfile uses the **repository root** as its build context (`context: .`), not `apps/api/`. This is required because the multi-stage build needs access to:

- `pnpm-lock.yaml` and workspace manifests at the root
- `packages/schema`, `packages/hf`, `packages/prediction`, `packages/ai-script` source and `tsconfig.base.json`

The first stage installs Node.js dependencies and compiles the TypeScript packages with `tsc`. The second stage copies the Node binary and built `dist/` directories into the Python runtime image.

If you build the image manually, always run from the repo root:

```bash
docker build -f apps/api/Dockerfile -t lineupcast-api .
```

## Bridge Support

The API container includes Node.js and the compiled bridge packages (`@lineupcast/prediction`, `@lineupcast/ai-script`). This enables the Python-to-TypeScript bridge scripts (`predict.mjs`, `generate-script.mjs`) to run inside the container for live predictions and script generation.

When `LINEUPCAST_PROVIDER_MODE` is set to `model`, the API uses the bridge to call the Dixon-Coles prediction engine and the deterministic script generator. In `mock` mode (the default), the API serves demo data without invoking Node.

## Services

| Service | Default URL             | Notes                                                    |
| ------- | ----------------------- | -------------------------------------------------------- |
| API     | `http://localhost:8000` | FastAPI service from `apps/api`, built with Node bridge. |
| Web     | `http://localhost:3000` | Next.js service from `apps/web`.                         |

Override ports in `.env`:

```bash
API_PORT=8100
WEB_PORT=3100
```

Then run:

```bash
docker compose up
```

## Health Checks

```bash
curl http://localhost:${API_PORT:-8000}/health
```

The compose file does not start Postgres unless a future profile adds it. This keeps the demo deployment lightweight and avoids requiring database credentials for the default run path.

## Production-like Local Testing

To test with PostgreSQL, Redis, and Nginx locally, use the production compose file:

```bash
cp .env.production.example .env
# Edit .env and set at least POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml up --build
```

This starts all five services (web, api, postgres, redis, nginx). Access the app at `http://localhost`.

## Troubleshooting

### Build fails with missing package.json

The Dockerfile copies package manifests individually for layer caching. If you added a new workspace package, add its `package.json` COPY line to the relevant Dockerfile (`apps/api/Dockerfile` or `apps/web/Dockerfile`).

### Port already in use

Change the port mapping in `.env` or stop the conflicting process:

```bash
lsof -i :8000
lsof -i :3000
```

### API container exits immediately

Check logs:

```bash
docker compose logs api
```

Common causes:
- Missing Python dependency in `requirements.txt`
- Syntax error in application code
- Missing environment variable

### Web container fails to build

Ensure `output: "standalone"` is set in `apps/web/next.config.ts`. The `apps/web/Dockerfile` depends on this to produce a minimal production image.

### Slow first build

The first build downloads and caches all dependencies. Subsequent builds use Docker layer caching and are much faster. Use `--no-cache` only when troubleshooting:

```bash
docker compose up --build --no-cache
```
