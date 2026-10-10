# multi-stage build: install deps in isolated stage, copy to slim runtime

FROM oven/bun:1.3.9 AS bun-base

FROM node:24-slim AS prod-deps

# copy bun from official image (avoids flaky curl install)
COPY --from=bun-base /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-base /usr/local/bin/bunx /usr/local/bin/bunx

WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages
COPY patches ./patches

# skip postinstall during docker build (it's dev-only setup)
RUN bun install --ignore-scripts

# rebuild native modules for linux
RUN bun rebuild oxc-parser 2>/dev/null || true

FROM node:24-slim AS runtime

RUN apt-get update && apt-get install -y \
  curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=bun-base /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-base /usr/local/bin/bunx /usr/local/bin/bunx

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY . .

# the web `one serve` service needs the prebuilt web assets (dist/client, dist/server).
# api-only deploys (staging) skip the host web build, so make the guard opt-out via
# --build-arg WEB_DIST_REQUIRED=false. the api/worker bundles below create dist/ anyway.
ARG WEB_DIST_REQUIRED=true
RUN if [ "$WEB_DIST_REQUIRED" = "true" ]; then \
      test -d dist || (echo "dist/ not found, did you build the app before building docker?" && exit 1); \
    fi

# pre-bundle the pg-boss worker with the react-server condition. bundling
# tree-shakes unused client code and resolves the `server-only` marker to a
# no-op, so the worker runs cleanly under plain bun (unlike `bun run` which
# eagerly evaluates every imported module including client react hooks).
# NODE_ENV=production is baked into the bundle: `bun build` inlines
# `process.env.NODE_ENV` at build time (defaulting to "development"), and the
# runtime env var cannot override an inlined constant. leaving it unset disables
# auth rate limiting and analytics in the deployed image.
ARG GIT_SHA=unknown
# package dist/ is gitignored; host copies can be stale, and bun install
# --ignore-scripts skips postinstall rebuilds. always rebuild in-image.
RUN echo "workspace packages for ${GIT_SHA}" && \
  rm -rf packages/*/dist && \
  (cd packages/helpers && bun run build) && \
  bun ./packages/run/src/run.ts build --no-root

RUN echo "worker bundle for ${GIT_SHA}" && \
  NODE_ENV=production bun build src/jobs/worker.ts --target bun --conditions react-server --outfile dist/worker.js

RUN echo "api bundle for ${GIT_SHA}" && \
  bun run api:manifest && \
  NODE_ENV=production bun build src/server/api-entry.ts --target bun --conditions react-server --outfile dist/api.js

RUN echo "api-docs bundle for ${GIT_SHA}" && \
  bun run api-docs:build

EXPOSE 8081

CMD ["bun", "one", "serve", "--port", "8081"]
