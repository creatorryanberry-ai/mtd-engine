# Api-only deploys (prod = staging model)

## Goal

Make production match staging: ship **api + worker** by default. Web is deferred and must be an **independent** deploy for both environments. Native production builds keep talking to the production API.

## Decisions

- Default backend deploy is always `api` + `worker` (prod and staging).
- Web is never included in the default deploy; it has its own command when needed.
- Until web ships, production env URLs all mirror the API host (same pattern as staging). `app.curatormtd.co.uk` stays unused.
- Explicit command names (exactly one of `--production` / `--staging` required; no aliases):
  - `bun tko uncloud deploy-api --production` → `.env.production`, services `api` + `worker`
  - `bun tko uncloud deploy-api --staging` → `.env.staging`, services `api` + `worker`
  - `bun tko uncloud deploy-web --production` → prod, service `web` only
  - `bun tko uncloud deploy-web --staging` → staging, service `web` only
- Reuse existing `runUncloudDeploy` / `deploy-core` (already supports service subsets and skips the web build when `web` is absent).
- `.env.production` (and example) align with staging URL pattern:
  - `API_SERVER_URL` / `VITE_API_HOSTNAME` / `BETTER_AUTH_URL` / `ONE_SERVER_URL` / `VITE_WEB_HOSTNAME` → `api.curatormtd.co.uk`
  - `HMRC_REDIRECT_URI` → `https://api.curatormtd.co.uk/api/hmrc/callback`
- When web ships later: set `VITE_WEB_HOSTNAME` / `ONE_SERVER_URL` to `app.curatormtd.co.uk`, keep API on `api.…`, run `deploy-web`.
- Native release unchanged: preview bakes `.env.staging`; production bakes `.env.production` (api-mirrored).
- Health / check-deployment expects `api` + `worker` (not `web`).
- After cutover, remove any leftover prod `web` container once (not every deploy).

## Non-goals

- Actually shipping the web app
- Changing staging hostname (`staging-api.curatormtd.co.uk` stays)
- Changing native store release flow beyond env URL alignment
- Renaming the Docker image (`mtd-web:latest` may still build api/worker images)

## Hosts (unchanged)

| Env | API (default ship) | Web (deferred) |
|---|---|---|
| Production | `api.curatormtd.co.uk` | `app.curatormtd.co.uk` (unused until `deploy-web`) |
| Staging | `staging-api.curatormtd.co.uk` | unused until `deploy-web --staging` |

## Files likely touched

- `scripts/uncloud/deploy-api.ts` (new), `deploy-web.ts` (new)
- `scripts/uncloud/check-deployment.ts` (+ health helper defaults if needed)
- `.env.production.example` (+ local `.env.production` documented, not committed)
- Docs/skills: `docs/deploy.md`, `docs/api-service.md`, `docs/architecture.md`, `docs/deploy-uncloud.md`, `docs/staging.md`, `README.md`, matching `.claude/skills/*`
