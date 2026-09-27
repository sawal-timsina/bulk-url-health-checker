# One image for the whole workspace; compose picks the process per service
# (migrate, api, worker, web). Simple to build and keeps versions in lockstep.

FROM docker.io/library/node:24-alpine AS base
RUN npm install --global pnpm@12.6.0
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
# Manifests first so the dependency layer is cached across source changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/queue/package.json packages/queue/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
# Topological: shared → db/queue → api/worker, and next build for web.
RUN pnpm -r build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app /app
