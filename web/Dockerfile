# syntax=docker/dockerfile:1
#
# Multi-stage image for the new HR app (Next.js standalone output).
#
# Targets:
#   runner   (default) - the production web server. Non-root, no Prisma CLI,
#                        no dev dependencies.
#   migrator           - one-shot job that runs `prisma migrate deploy` and exits.
#
# Migrations run as a separate step, not on app start. Compose runs the
# `web-migrate` service to completion before starting `web`. In other
# environments, run the migrator image once per release before rolling out
# the runner. If several app replicas each migrated on start, they would race
# each other, and the runtime image would need the Prisma CLI.
#
# Build:   docker build -t hr-web ./web
#          docker build -t hr-web-migrate --target migrator ./web

ARG NODE_VERSION=26

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------
# All dependencies (incl. dev). The postinstall hook runs `prisma generate`,
# so the schema and Prisma config must exist before `npm ci`.
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
COPY prisma7.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------------------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Real secrets are not available at build time. Runtime validation still
# happens on server start (src/instrumentation.ts).
ENV SKIP_ENV_VALIDATION=1
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
# One-shot migration job: needs the Prisma CLI, the schema and migrations.
FROM base AS migrator
ENV NODE_ENV=production \
    PRISMA_HIDE_UPDATE_MESSAGE=1
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs migrator
COPY --from=deps --chown=migrator:nodejs /app/node_modules ./node_modules
COPY --chown=migrator:nodejs package.json prisma7.config.ts ./
COPY --chown=migrator:nodejs prisma ./prisma
USER migrator
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache tini
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
