# Multi-stage build for the React (Vite) SPA.
#
# Build context MUST be the monorepo root, not apps/web — same reason as
# apps/api/Dockerfile (pnpm workspace lockfile only exists at the root).
# On Railway: Root Directory = "." (repo root), Dockerfile Path =
# "apps/web/Dockerfile".

FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS development
COPY apps/web ./apps/web
WORKDIR /app/apps/web
EXPOSE 5173
CMD ["pnpm", "dev", "--host"]

FROM deps AS build
COPY apps/web ./apps/web
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm --filter ./apps/web build

# ---- production runtime: static files behind nginx -----------------------
FROM nginx:1.27-alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
