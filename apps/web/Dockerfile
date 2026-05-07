# ── Stage 1: Install dependencies and build ──────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable

WORKDIR /workspace

# Copy workspace scaffold and lockfile for layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package manifests for the dependency chain
COPY packages/schema/package.json     packages/schema/
COPY packages/overlay-renderer/package.json packages/overlay-renderer/
COPY apps/web/package.json            apps/web/

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/ packages/
COPY apps/web/ apps/web/

# Build shared packages first, then the web app
RUN pnpm --filter @lineupcast/schema build && \
    pnpm --filter @lineupcast/overlay-renderer build && \
    pnpm --filter @lineupcast/web build

# ── Stage 2: Production runner ──────────────────────────────────────────────
FROM node:20-slim AS runner

RUN corepack enable

WORKDIR /workspace

# Copy only what's needed to run
COPY --from=builder /workspace/apps/web/.next/standalone ./
COPY --from=builder /workspace/apps/web/.next/static ./apps/web/.next/static

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
