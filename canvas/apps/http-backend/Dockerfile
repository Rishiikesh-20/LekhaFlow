# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy all package.json files for dependency resolution
COPY apps/http-backend/package.json ./apps/http-backend/
COPY packages/config/package.json ./packages/config/
COPY packages/common/package.json ./packages/common/
COPY packages/http-core/package.json ./packages/http-core/
COPY packages/logger/package.json ./packages/logger/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/typescript-config/package.json ./packages/typescript-config/
# Needed for workspace resolution even if not directly used
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
COPY apps/ws-backend/package.json ./apps/ws-backend/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──
FROM base AS builder
WORKDIR /app

# Copy source code
COPY packages/ ./packages/
COPY apps/http-backend/ ./apps/http-backend/

# Build internal packages first, then the app
RUN pnpm --filter @repo/typescript-config build 2>/dev/null || true && \
    pnpm --filter @repo/logger build && \
    pnpm --filter @repo/http-core build && \
    pnpm --filter @repo/common build && \
    pnpm --filter @repo/config build && \
    pnpm --filter @repo/supabase build && \
    pnpm --filter http-backend build

# ── Stage 3: Production image ──
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files
COPY apps/http-backend/package.json ./apps/http-backend/
COPY packages/config/package.json ./packages/config/
COPY packages/common/package.json ./packages/common/
COPY packages/http-core/package.json ./packages/http-core/
COPY packages/logger/package.json ./packages/logger/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
COPY apps/ws-backend/package.json ./apps/ws-backend/

RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/apps/http-backend/dist ./apps/http-backend/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/http-core/dist ./packages/http-core/dist
COPY --from=builder /app/packages/logger/dist ./packages/logger/dist
COPY --from=builder /app/packages/supabase/dist ./packages/supabase/dist

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["node", "apps/http-backend/dist/index.js"]
