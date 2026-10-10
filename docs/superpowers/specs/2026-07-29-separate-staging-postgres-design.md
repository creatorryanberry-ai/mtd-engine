# Separate staging Postgres instance

## Goal

Staging uses its own managed Postgres **instance** (different host from production), not a second database name on the production Postgres server.

## Decisions

- Staging and production each have a sibling managed Postgres instance. App database name on both is `curatormtd`.
- Point `.env.staging` `DEPLOY_DB` / `DATABASE_URL` at the staging host; production env points at the production host.
- Staging deploy path stays `bun tko uncloud deploy-api --staging`.
- Staging deploy isolation guard: refuse if the staging DB host matches production’s Postgres host (read from `.env.production` when available, with a committed fallback for the current prod host `34.13.41.244`). Unit-tested with a clear error.
- Lasting docs/skills and `.env.staging.example` describe a separate managed instance (no hard-coded prod IP in the staging example).

## Non-goals

- IaC or automation to create Cloud SQL / managed instances
- Self-hosted `pgdb` on the staging VM

## Files

- Staging deploy assert helper (+ unit test) under `scripts/uncloud/helpers/`
- `.env.staging.example`
- Docs/skills: `docs/staging.md`, `docs/api-service.md` (skills regenerate from docs)
