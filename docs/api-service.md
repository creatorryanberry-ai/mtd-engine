---
name: api-service
description: Standalone api service — dist/api.js, hosts, routing, handshake, deploy.
---

# api service

The native app talks to a standalone api process, deployed independently of the web app. This keeps the api's blast radius, scaling, and release cadence separate from the (not-yet-shipped) web frontend, and lets a given app release target a specific api.

## hosts

The app derives its api base url from `API_SERVER_URL` / `VITE_API_HOSTNAME`, which are baked into the native bundle per build variant:

- production build → `https://api.straightup.tax`
- preview build → `https://staging-api.straightup.tax`

Preview builds resolve these from `.env.staging` only and never fall back to production, so a TestFlight build can never point at prod data (see `scripts/release/helpers/env.ts`).

## how it runs

The service is a single Bun server bundled to `dist/api.js` from `src/server/api-entry.ts`. It serves `/api/**` using a generated route manifest (`src/server/routeManifest.generated.ts`) rather than the web/SSR runtime.

```bash
bun run api:manifest   # regenerate the route manifest from app/api/**+api.ts
bun run api:build      # bundle dist/api.js
bun run api:serve      # run the bundled server locally
```

The manifest is checked into git and validated in CI (`scripts/check/api-manifest.ts`) so it never drifts from the route files. Regenerate and commit it whenever you add, remove, or move an `app/api/**/*+api.ts` route.

Web-tier routes stay on the web service and are excluded from the manifest — most notably `/api/og` (OpenGraph image rendering), which pulls in native render deps the api bundle should not carry.

When `ENABLE_API_DOCS=1` and `dist/api-docs/` is present (Docker image build runs `bun run api-docs:build`), the api serves the Scalar OpenAPI UI at `/docs`. The flag defaults off so production does not host docs; staging enables it and protects that path with Cloudflare Access. See [staging](./staging.md).

## api docs

The OpenAPI spec at `/docs` documents the full api-service surface, including auth routes (`/api/auth/**`).

To try protected routes in Scalar: send an OTP with `POST /api/auth/email-otp/send-verification-otp` (`type: "sign-in"`), complete `POST /api/auth/sign-in/email-otp` with the code, copy the `token` from the response, then set Authorization Bearer in Scalar's auth panel.

Cloudflare Access on `/docs` only gates who can open the docs UI in a browser — it is not API authentication. Protected `/api/**` routes still require a session cookie or Bearer token from app auth.

Locally, `bun run api-docs` builds and serves Scalar without Cloudflare Access.

## deploy

The api ships as its own service in `src/uncloud/docker-compose.yml` (`command: bun run dist/api.js`) on its own subdomain. The default backend deploy is always `api` + `worker` (production and staging); web is independent via `deploy-web`:

- production: `bun tko uncloud deploy-api --production` deploys `api` and `worker`.
- staging: `bun tko uncloud deploy-api --staging` deploys `api` and `worker`.
- web (deferred): `bun tko uncloud deploy-web --production` / `deploy-web --staging` when the web app ships.

Database migrations run once per deploy against that environment’s managed Postgres (`DEPLOY_DB`) before the services roll. Staging and production use separate Postgres instances.

## health checks

```bash
curl -fsS https://api.straightup.tax/api/health
curl -fsS https://api.straightup.tax/api/handshake -H "x-app-version: 0.0.0"
```

`/api/health` reports the deployed `GIT_SHA`. `GET /api/handshake` returns numeric `apiContract` and whether the calling app version is `ok`, `nudge`, or must force-upgrade — the last-resort safety net for old clients (OTA hot updates handle most fixes first). Incompatible shape changes bump `apiContract`; a CI OpenAPI guard blocks breaking changes.
