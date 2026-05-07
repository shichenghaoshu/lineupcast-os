# Production Deployment Guide

This guide covers deploying LineupCast OS to a production server using Docker Compose with Nginx, PostgreSQL, and Redis.

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A server with at least 2 GB RAM and 2 CPU cores
- A domain name (for SSL/TLS)
- API keys for your chosen LLM provider and football data provider

## 1. Clone and Configure

```bash
git clone https://github.com/your-org/lineupcast-os.git
cd lineupcast-os
```

Create the environment file:

```bash
cp .env.production.example .env
```

Edit `.env` and fill in the required values. At minimum you must set:

| Variable            | Required | Description                            |
| ------------------- | -------- | -------------------------------------- |
| `POSTGRES_PASSWORD` | Yes      | Strong password (16+ chars)            |
| `OPENAI_API_KEY`    | Yes      | API key for your LLM provider         |
| `FOOTBALL_DATA_API_KEY` | Yes  | Key from football-data.org             |

## 2. SSL/TLS Setup

### Option A: Let's Encrypt (recommended)

Install certbot on the host and obtain certificates:

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
```

Copy certificates into the deploy directory:

```bash
mkdir -p deploy/nginx/certs
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem deploy/nginx/certs/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem deploy/nginx/certs/
sudo chown $(whoami) deploy/nginx/certs/*.pem
```

Uncomment the HTTPS server block in `deploy/nginx/nginx.conf` and update `server_name`.

Set up auto-renewal:

```bash
sudo crontab -e
# Add: 0 3 * * * certbot renew --deploy-hook "cp /etc/letsencrypt/live/your-domain.com/*.pem /path/to/deploy/nginx/certs/ && docker compose -f /path/to/docker-compose.prod.yml exec nginx nginx -s reload"
```

### Option B: Self-signed (development/testing)

```bash
mkdir -p deploy/nginx/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout deploy/nginx/certs/privkey.pem \
  -out deploy/nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```

## 3. Build and Start

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Verify all services are healthy:

```bash
docker compose -f docker-compose.prod.yml ps
```

Expected output: all services show `healthy` status.

## 4. Verify Deployment

```bash
# API health
curl http://localhost/api/health

# Web app
curl -I http://localhost/
```

## Environment Variable Reference

### Runtime

| Variable       | Default      | Description                              |
| -------------- | ------------ | ---------------------------------------- |
| `APP_ENV`      | `production` | Runtime environment identifier           |
| `HTTP_PORT`    | `80`         | Host port for HTTP                       |
| `HTTPS_PORT`   | `443`        | Host port for HTTPS                      |

### Database

| Variable            | Default       | Description                         |
| ------------------- | ------------- | ----------------------------------- |
| `POSTGRES_DB`       | `lineupcast`  | Database name                       |
| `POSTGRES_USER`     | `lineupcast`  | Database user                       |
| `POSTGRES_PASSWORD` | (required)    | Database password                   |
| `REDIS_URL`         | `redis://redis:6379/0` | Redis connection string    |

### LLM Provider

| Variable               | Default                  | Description                          |
| ---------------------- | ------------------------ | ------------------------------------ |
| `LLM_PROVIDER`         | `openai-compatible`      | Provider type                        |
| `OPENAI_API_KEY`       | (required)               | API key                              |
| `OPENAI_BASE_URL`      | `https://api.openai.com/v1` | Base URL for OpenAI-compatible API |
| `OPENAI_MODEL`         | `gpt-4o-mini`            | Model identifier                     |

### Safety Flags

| Variable                | Default | Description                              |
| ----------------------- | ------- | ---------------------------------------- |
| `ENABLE_AI_NARRATION`   | `true`  | Enable AI match narration                |
| `ENABLE_BETTING_ADVICE` | `false` | Enable betting advice output             |
| `REQUIRE_DISCLAIMER`    | `true`  | Require disclaimer on predictions        |
| `ALLOW_SYNTHETIC_DATA`  | `false` | Allow synthetic data fallback            |
| `LOG_LLM_PROMPTS`       | `false` | Log LLM prompts (disable in production)  |

## Monitoring

### Health Endpoints

| Service  | Endpoint                       | Expected Response |
| -------- | ------------------------------ | ----------------- |
| API      | `GET /api/health`              | `200 OK`          |
| Nginx    | `GET /health`                  | `200 ok`          |
| Web      | `GET /`                        | `200 OK`          |

### Docker Health Checks

All services have built-in health checks. Monitor with:

```bash
docker compose -f docker-compose.prod.yml ps
```

### Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f nginx
```

## Backup and Restore

### Automated Backup

Back up the PostgreSQL database:

```bash
./deploy/scripts/backup-postgres.sh
```

This creates a compressed backup in `./backups/` and keeps the last 7 backups.

### Automate with Cron

```bash
crontab -e
# Add: 0 2 * * * cd /path/to/lineupcast-os && ./deploy/scripts/backup-postgres.sh
```

### Restore from Backup

```bash
./deploy/scripts/restore-postgres.sh ./backups/lineupcast_20260507_020000.sql.gz
```

You will be prompted to confirm before the database is dropped and restored.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

## Stopping

```bash
docker compose -f docker-compose.prod.yml down
```

To also remove volumes (data loss):

```bash
docker compose -f docker-compose.prod.yml down -v
```

## Troubleshooting

### API container fails to start

Check logs: `docker compose -f docker-compose.prod.yml logs api`

Common causes:
- Missing `POSTGRES_PASSWORD` in `.env`
- Database not ready (wait for health check)
- Invalid API key

### Web container fails to build

Ensure `output: "standalone"` is set in `apps/web/next.config.ts`. This is the default in the repository.

### Nginx returns 502

The upstream service is not healthy. Check:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml logs web
```

### Database connection refused

Ensure the `postgres` container is healthy before the API starts. The `depends_on` with `condition: service_healthy` handles this automatically.
