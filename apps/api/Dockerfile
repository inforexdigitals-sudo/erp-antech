# Multi-stage build for the NestJS API.
#
# Build context MUST be the monorepo root, not apps/api — this is a pnpm
# workspace, and the lockfile (pnpm-lock.yaml) only exists at the root, so
# `pnpm install --frozen-lockfile` needs root-level files present to
# resolve anything. On Railway (or any platform that lets you set these
# independently): Root Directory = "." (repo root), Dockerfile Path =
# "apps/api/Dockerfile". docker-compose builds from ../.. for the same
# reason — see infra/docker/docker-compose.yml.
#
# Every stage keeps the real apps/api/* paths under /app (never flattened
# to /app/*) so pnpm's node_modules symlinks — which point relative to a
# shared content-addressable store at the workspace root — keep resolving
# correctly after being COPYed between stages.

# ---- base ----------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# ---- dependencies (whole workspace, so pnpm can resolve the lockfile) ----
# apps/api/prisma is copied in before `pnpm install` (not just package.json)
# because @prisma/client's postinstall hook auto-runs `prisma generate` as
# part of install — without schema.prisma present yet, that silently
# produces a stub client with almost no exported types, which every later
# stage then inherits since they all build FROM deps.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile

# ---- development (used by infra/docker/docker-compose.yml, with a bind mount) ----
FROM deps AS development
COPY apps/api ./apps/api
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["pnpm", "start:dev"]

# ---- build -------------------------------------------------------------
FROM deps AS build
COPY apps/api ./apps/api
RUN pnpm --filter ./apps/api prisma:generate
RUN pnpm --filter ./apps/api build

# ---- production runtime -------------------------------------------------
# node_modules comes straight from `build`, not a separate --prod-only
# install: a --prod install skips devDependencies, and the `prisma` CLI
# (needed to run `prisma generate`) lives there — so a prod-only stage
# can never regenerate the client itself, and would otherwise ship
# whatever stub `@prisma/client`'s postinstall produced (see `deps`
# stage's comment). Reusing `build`'s already-verified-correct
# node_modules trades a larger image for actually being correct.
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S antech && adduser -S antech -G antech
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
WORKDIR /app/apps/api
USER antech
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://localhost:${PORT:-3000}/api/v1/health" || exit 1
CMD ["node", "dist/main.js"]
