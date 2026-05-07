# API Configuration Guide

> For commentary assistance, not betting advice.

This guide explains how to configure external service connections in LineupCast OS. Configuration can be done via environment variables (`.env` file) or, starting from V0.2, via the API Configuration Center with database persistence.

---

## Table of Contents

1. [Football-Data.org API Key](#football-dataorg-api-key)
2. [Hugging Face Endpoint](#hugging-face-endpoint)
3. [OpenAI-Compatible Endpoint](#openai-compatible-endpoint)
4. [OBS Public URL](#obs-public-url)
5. [Environment Variables vs Database Config](#environment-variables-vs-database-config)
6. [Security Best Practices](#security-best-practices)

---

## Football-Data.org API Key

Football-Data.org provides free-tier access to fixture, match, and standings data for major European leagues.

### Step 1: Register

1. Go to [football-data.org](https://www.football-data.org/client/register).
2. Create a free account.
3. Copy your API key from the dashboard.

### Step 2: Configure via Environment Variable

Add to your `.env` file:

```bash
FOOTBALL_DATA_API_KEY=your_api_key_here
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4
```

### Step 3: Configure via API (V0.2+)

```bash
curl -X PUT http://localhost:8000/api/config/provider/football-data \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "your_api_key_here",
    "base_url": "https://api.football-data.org/v4"
  }'
```

### Verification

```bash
# Check provider health
curl http://localhost:8000/api/providers | jq '.[] | select(.id == "football-data-org")'
```

Expected response includes `"status": "healthy"` and recent `lastSuccessfulCall` timestamp.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `403 Forbidden` from football-data.org | Invalid or expired API key | Regenerate key at football-data.org dashboard |
| `429 Too Many Requests` | Free tier rate limit (10 requests/minute) | Wait 60 seconds or upgrade plan |
| Provider shows `status: "unreachable"` | Network issue or wrong base URL | Check `FOOTBALL_DATA_BASE_URL` and network connectivity |
| Empty fixture list | Season not started or API key lacks competition access | Verify competition coverage on your plan |

---

## Hugging Face Endpoint

Hugging Face can serve as the LLM narration backend. Two modes are supported: Inference API (shared) and Inference Endpoint (dedicated).

### Option A: Hugging Face Inference API (Shared)

Best for development and low-volume use.

```bash
HUGGINGFACE_API_TOKEN=hf_your_token_here
HUGGINGFACE_MODEL_ID=mistralai/Mistral-7B-Instruct-v0.2
LLM_PROVIDER=huggingface-endpoint
```

### Option B: Hugging Face Inference Endpoint (Dedicated)

Best for production with consistent latency.

1. Create an Inference Endpoint at [huggingface.co/inference-endpoints](https://huggingface.co/inference-endpoints).
2. Note the endpoint URL and token.

```bash
HUGGINGFACE_ENDPOINT_URL=https://your-endpoint.endpoints.huggingface.cloud
HUGGINGFACE_ENDPOINT_TOKEN=hf_your_endpoint_token
LLM_PROVIDER=huggingface-endpoint
```

### Verification

```bash
# Test the LLM provider
curl -X POST http://localhost:8000/api/matches/demo/script \
  -H "Content-Type: application/json" \
  -d '{"language": "en", "tone": "professional"}'
```

If the response includes a `script` field with commentary text, the endpoint is working.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `401 Unauthorized` | Invalid token | Regenerate token at huggingface.co/settings/tokens |
| `503 Model Loading` | Cold start on shared inference | Wait 30-60 seconds and retry |
| Timeout after 30s | Model too large for shared tier | Switch to dedicated Inference Endpoint |
| Fallback script returned | LLM provider failed, fallback triggered | Check `LLM_PROVIDER` value and token validity |

---

## OpenAI-Compatible Endpoint

Use any service that implements the OpenAI chat completions API format, including OpenAI, Azure OpenAI, local models via llama.cpp, or other hosted gateways.

### Configuration

```bash
LLM_PROVIDER=openai-compatible
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

### Using a Local Model (e.g., Ollama)

```bash
LLM_PROVIDER=openai-compatible
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=not-needed
OPENAI_MODEL=llama3
```

### Using Azure OpenAI

```bash
LLM_PROVIDER=openai-compatible
OPENAI_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment
OPENAI_API_KEY=your-azure-key
OPENAI_MODEL=gpt-4o-mini
```

### Verification

Same as Hugging Face -- generate a script and check for valid output.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `Connection refused` | Base URL incorrect or service not running | Verify URL and that the service is accessible |
| `401 Unauthorized` | Invalid API key | Check key at provider dashboard |
| `model_not_found` | Model name mismatch | Check exact model name in provider docs |
| Slow responses | Large model or distant endpoint | Use a smaller model or closer endpoint |

---

## OBS Public URL

LineupCast can generate overlay metadata for broadcast tools like OBS Studio. The overlay renderer produces HTML/PNG files that OBS can consume via Browser Source.

### Configuration

Set the public URL where overlay files will be served:

```bash
# In your deployment, overlays are served from:
# http://your-server:8000/api/matches/{match_id}/overlay
```

### Using with OBS Studio

1. In OBS, add a **Browser Source**.
2. Set the URL to your overlay endpoint:

```text
http://localhost:8000/api/matches/demo-match-001/overlay
```

3. Set width to `1920` and height to `1080`.
4. Enable **Shutdown source when not visible** to save resources.

### Production URL

For production deployments, replace `localhost` with your server's public domain:

```text
https://your-domain.com/api/matches/{match_id}/overlay
```

Ensure CORS headers allow your OBS browser source origin if cross-origin.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Blank overlay in OBS | URL not reachable from OBS machine | Use public IP or domain, not localhost |
| CORS error in OBS browser | Missing CORS origin | Add OBS origin to allowed CORS origins |
| Stale overlay data | Cached response | Add `?t={timestamp}` cache-buster to URL |

---

## Environment Variables vs Database Config

LineupCast supports two configuration methods. Understanding when to use each is important.

### Environment Variables (`.env`)

- **When to use:** Local development, Docker deployments, CI/CD.
- **Behavior:** Read once at startup. Changes require restarting the API server.
- **Precedence:** Environment variables take precedence over database config for safety-critical settings (`ENABLE_BETTING_ADVICE`, `REQUIRE_DISCLAIMER`).
- **Scope:** Single instance. Multiple instances need separate `.env` files.

```bash
# Example .env
FOOTBALL_DATA_API_KEY=abc123
LLM_PROVIDER=openai-compatible
OPENAI_API_KEY=sk-xxx
```

### Database Config (V0.2+)

- **When to use:** Multi-instance deployments, runtime configuration changes, admin UI.
- **Behavior:** Read on each request. Changes take effect immediately without restart.
- **Precedence:** Database config is overridden by environment variables for safety flags.
- **Scope:** Shared across all instances connected to the same database.

```bash
# Update via API
curl -X PUT http://localhost:8000/api/config/provider/football-data \
  -H "X-Admin-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "new-key"}'
```

### Precedence Rules

| Setting Type | Environment Variable | Database Config | Winner |
|-------------|---------------------|-----------------|--------|
| Safety flags (`ENABLE_BETTING_ADVICE`, etc.) | Set | Set | Env var |
| Safety flags | Not set | Set | Database |
| Provider keys | Set | Set | Env var (for backward compat) |
| Provider keys | Not set | Set | Database |
| LLM settings | Set | Set | Env var |

**Rule of thumb:** Safety flags are always controlled by environment variables in production. Provider keys can be managed via either method.

---

## Security Best Practices

### API Key Storage

1. **Never commit `.env` files** to version control. The `.gitignore` should exclude `.env`.
2. **Use secrets management** in production: Docker secrets, AWS Secrets Manager, HashiCorp Vault, or similar.
3. **Rotate keys regularly.** Set a calendar reminder to rotate API keys every 90 days.
4. **Use the minimum required permissions.** Football-data.org free tier is read-only by default -- do not use keys with write access.

### Admin Token

1. **Always set `LINEUPCAST_ADMIN_TOKEN`** in production. Leaving it unset disables authentication on write endpoints.
2. **Use a strong token:** at least 32 random characters.

```bash
# Generate a secure token
openssl rand -hex 32
```

3. **Do not share the admin token** across environments. Use separate tokens for staging and production.

### Network Security

1. **Use HTTPS** in production. Never send API keys over plain HTTP.
2. **Restrict CORS origins** to your known frontend domains. Do not use `*` in production.
3. **Rate limit** public endpoints. The built-in rate limiter (V0.4+) protects against abuse.

### LLM Provider Keys

1. **Store LLM keys separately** from data provider keys. Different teams may manage each.
2. **Set spending limits** at the LLM provider (OpenAI, Hugging Face) to prevent runaway costs.
3. **Disable prompt logging** in production (`LOG_LLM_PROMPTS=false`). Logged prompts may contain sensitive match data.

### Checklist

- [ ] `.env` is in `.gitignore`
- [ ] `LINEUPCAST_ADMIN_TOKEN` is set and strong
- [ ] `ENABLE_BETTING_ADVICE=false` confirmed
- [ ] `REQUIRE_DISCLAIMER=true` confirmed
- [ ] HTTPS enabled for all endpoints
- [ ] CORS restricted to known origins
- [ ] API keys rotated within last 90 days
- [ ] LLM spending limits configured at provider

---

## Disclaimer

LineupCast OS is an educational and analytical tool for pre-match commentary preparation. It is not a betting service. Predictions are probabilistic estimates based on historical data -- they are not guarantees. Always verify information independently.
