# Staging API docs behind Cloudflare Access

## Goal

Make the Scalar OpenAPI docs available at `https://staging-api.curatormtd.co.uk/docs`, reachable only by `@curator.org.uk` Google accounts via Cloudflare Access. Preview/TestFlight traffic to `/api/**` must stay unaffected.

## Decisions

- **Host/path:** same staging API host, path `/docs` (and `/docs/*` assets). Not a separate subdomain.
- **Auth:** Cloudflare Access with Google as IdP; policy allows email domain `curator.org.uk`. Path include is `/docs*` only — no Access application on `/api/**`.
- **Serving:** build the existing `api-docs/` Vite app to static files (`dist/api-docs/`, Vite `base: '/docs/'`), copy into the Docker image, serve from the standalone API fetch handler before the route manifest. Missing build → `/docs` 404; API health unchanged.
- **DNS:** orange-cloud `staging-api.curatormtd.co.uk` (today it hits the VM directly; prod already uses Cloudflare). SSL/origin setup mirrors production so Caddy ↔ Cloudflare keeps working.
- **Ops:** Access application + DNS proxy are manual Cloudflare console steps — not automated in Uncloud deploy scripts.
- **Local:** `bun api-docs` (port 6007) unchanged; no Access in local dev.

## Why `/api/**` stays ungated

Staging `/api/**` is already public and protected by app-level auth (sessions/bearer, rate limits). Preview builds call that host with no browser SSO. Access on `/api/**` would require service tokens in the app and is out of scope. Leaving the API ungated is intentional and normal for a mobile backend; optional later hardening is WAF/rate limits, not Access on the API.

## Non-goals

- Production docs hosting
- Better-auth Google social login
- Automating Cloudflare Access or DNS in deploy scripts
- Gating `/api/**` or baking Access service tokens into preview builds

## Flow

```
Browser → Cloudflare (Access on /docs*) → Caddy → api container → static Scalar
App     → Cloudflare (no Access)        → Caddy → api container → /api/**
```

## In-repo work

- Vite production build for `api-docs/` with `base: '/docs/'`
- Dockerfile step to build docs into `dist/api-docs/`
- Static-file branch in API fetch (`src/server/api-entry.ts` / router helper): `/docs` → `index.html`, `/docs/*` → assets under `dist/api-docs`
- Docs/skills: staging URL + Access + orange-cloud note (`docs/staging.md`, `docs/api-service.md`)

## Manual Cloudflare steps

1. Proxy DNS for `staging-api.curatormtd.co.uk` (orange cloud); confirm SSL mode matches prod origin cert setup.
2. Zero Trust → Access → application on that hostname, path `/docs*`.
3. Identity provider: Google; policy: allow emails ending in `@curator.org.uk`.
4. Confirm `/api/health` and `/api/v1/handshake` succeed with no Access cookie.

## Verification

- No Access session: `/docs` → Access login; `/api/health` and handshake still 200
- `@curator.org.uk` Google login: Scalar UI loads with OpenAPI spec
- Other Google account: Access denies
- Preview/TestFlight: no regression (no Access cookie for `/api/**`)
