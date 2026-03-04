# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

# Copy workspace root config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy all package.json files for dependency resolution
COPY apps/web/package.json ./apps/web/
COPY apps/http-backend/package.json ./apps/http-backend/
COPY apps/ws-backend/package.json ./apps/ws-backend/
COPY packages/config/package.json ./packages/config/
COPY packages/common/package.json ./packages/common/
COPY packages/http-core/package.json ./packages/http-core/
COPY packages/logger/package.json ./packages/logger/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──
FROM base AS builder
WORKDIR /app

# Next.js collects anonymous telemetry — disable it
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time env vars are baked into the client bundle by Next.js.
# These ARGs are passed via docker-compose build.args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_HTTP_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_HTTP_URL=$NEXT_PUBLIC_HTTP_URL

# Copy source code
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Build internal packages first, then the app
RUN pnpm --filter @repo/typescript-config build 2>/dev/null || true && \
    pnpm --filter @repo/logger build && \
    pnpm --filter @repo/http-core build && \
    pnpm --filter @repo/common build && \
    pnpm --filter @repo/config build && \
    pnpm --filter @repo/supabase build && \
    pnpm --filter web build

# ── Stage 3: Production image ──
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static   ./apps/web/.next/static
COPY --from=builder /app/apps/web/public          ./apps/web/public

# Pre-create the image/fetch cache directory so the non-root user can write to it
RUN mkdir -p ./apps/web/.next/cache && \
    chown -R nextjs:nodejs ./apps/web/.next

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/web/server.js"]
