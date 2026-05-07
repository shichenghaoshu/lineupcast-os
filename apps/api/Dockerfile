# ── Stage 1: Build TypeScript bridge packages ─────────────────────────────
FROM node:20-slim AS ts-builder

RUN corepack enable

WORKDIR /workspace

# Copy workspace scaffold and lockfile first for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package manifests for the bridge dependency chain
COPY packages/schema/package.json    packages/schema/
COPY packages/hf/package.json        packages/hf/
COPY packages/prediction/package.json packages/prediction/
COPY packages/ai-script/package.json  packages/ai-script/

RUN pnpm install --frozen-lockfile

# Copy source and build in dependency order
COPY packages/ packages/

RUN pnpm --filter @lineupcast/schema build && \
    pnpm --filter @lineupcast/hf build && \
    pnpm --filter @lineupcast/prediction build && \
    pnpm --filter @lineupcast/ai-script build

# ── Stage 2: Python runtime with Node.js bridge ──────────────────────────
FROM python:3.12-slim

# Copy Node.js binary + standard library from the builder
COPY --from=ts-builder /usr/local/bin/node /usr/local/bin/node
COPY --from=ts-builder /usr/local/lib/node_modules /usr/local/lib/node_modules

WORKDIR /workspace

# Copy only the built dist/ directories needed by the bridge scripts
COPY --from=ts-builder /workspace/packages/schema/dist     packages/schema/dist
COPY --from=ts-builder /workspace/packages/hf/dist         packages/hf/dist
COPY --from=ts-builder /workspace/packages/prediction/dist packages/prediction/dist
COPY --from=ts-builder /workspace/packages/ai-script/dist  packages/ai-script/dist

# Install Python dependencies
COPY apps/api/requirements.txt apps/api/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r apps/api/requirements.txt

# Copy application code (preserves monorepo-relative paths for bridge scripts)
COPY apps/api/app     apps/api/app
COPY apps/api/src     apps/api/src
COPY apps/api/scripts apps/api/scripts

WORKDIR /workspace/apps/api

ENV PYTHONPATH=/workspace/apps/api \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
