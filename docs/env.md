# Environment Variables

Copy `.env.example` to `.env` for local development.

```bash
cp .env.example .env
```

## Runtime

| Variable                   | Default | Purpose                                                                                                                |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                  | `local` | Runtime label.                                                                                                         |
| `API_PORT`                 | `8000`  | API server port.                                                                                                       |
| `WEB_PORT`                 | `3000`  | Web server port.                                                                                                       |
| `LINEUPCAST_PROVIDER_MODE` | `mock`  | Use `mock` for bundled demo data, `model` for the local TypeScript bridge, or `external` for configured provider mode. |
| `LINEUPCAST_ADMIN_TOKEN`   | unset   | Optional bearer token required by write/admin API endpoints when set.                                                  |

## LLM Provider Env Vars

| Variable                     | Purpose                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `LLM_PROVIDER`               | Selects narration backend, for example `openai-compatible`, `huggingface-endpoint`, or `none`. |
| `LLM_MODEL`                  | Generic model selector if provider-specific model vars are not used.                           |
| `OPENAI_API_KEY`             | API key for OpenAI-compatible endpoints.                                                       |
| `OPENAI_BASE_URL`            | Base URL for OpenAI-compatible endpoints.                                                      |
| `OPENAI_MODEL`               | Model name for OpenAI-compatible endpoints.                                                    |
| `HUGGINGFACE_API_TOKEN`      | Hugging Face token for model access.                                                           |
| `HUGGINGFACE_MODEL_ID`       | Hugging Face model id.                                                                         |
| `HUGGINGFACE_ENDPOINT_URL`   | Dedicated Hugging Face Inference Endpoint URL.                                                 |
| `HUGGINGFACE_ENDPOINT_TOKEN` | Token for the dedicated endpoint.                                                              |

## Data Provider Keys

| Variable                 | Purpose                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `FOOTBALL_DATA_API_KEY`  | football-data.org API key when used.                       |
| `FOOTBALL_DATA_BASE_URL` | football-data.org API base URL.                            |
| `FBREF_API_KEY`          | Optional key or adapter token for FBref-derived ingestion. |
| `STATBOMB_API_KEY`       | Optional StatBomb-compatible key.                          |
| `OPENFOOTBALL_DATA_URL`  | Optional OpenFootball dataset URL or mirror.               |

## Safety Flags

| Variable                | Default | Purpose                                                |
| ----------------------- | ------- | ------------------------------------------------------ |
| `ENABLE_AI_NARRATION`   | `true`  | Enables generated script wording.                      |
| `ENABLE_BETTING_ADVICE` | `false` | Must remain false for commentary deployments.          |
| `REQUIRE_DISCLAIMER`    | `true`  | Requires disclaimer attachment to generated scripts.   |
| `ALLOW_SYNTHETIC_DATA`  | `true`  | Allows demo/mock data in local and sample deployments. |
| `LOG_LLM_PROMPTS`       | `false` | Enables prompt logging for development only.           |
