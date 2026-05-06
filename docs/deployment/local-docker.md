# Local Docker Deployment

This project can run locally with Docker Compose without a PostgreSQL service by default. The API currently serves demo data and the web app connects to it through `NEXT_PUBLIC_API_URL`.

## Prerequisites

- Docker Desktop or a compatible Docker Engine.
- A copy of `.env`, usually created from `.env.example`.

```bash
cp .env.example .env
docker compose up --build
```

## Services

| Service | Default URL | Notes |
| --- | --- | --- |
| API | `http://localhost:8000` | FastAPI service from `apps/api`. |
| Web | `http://localhost:3000` | Next.js service from `apps/web`. |

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
