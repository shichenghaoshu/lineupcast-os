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
