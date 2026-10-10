# Staging Refocus onto the Standalone API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the preview/TestFlight app an isolated **staging API** at `staging-api.curatormtd.co.uk` (standalone API service, no web app), so preview builds exercise a real backend that never touches production data — and production builds target `api.curatormtd.co.uk`.

> **Hostname note:** staging uses the single-level host `staging-api.curatormtd.co.uk` (not the two-level `api.staging.…`) so it's covered by the existing Cloudflare Universal SSL + `*.curatormtd.co.uk` origin cert with no Advanced Certificate Manager or extra cert.

**Architecture:** This supersedes the web-coupled model in `docs/superpowers/plans/2026-07-17-staging-backend.md`. Staging is still "production mode + staging values on isolated infra" (separate VM, separate `curatormtd_staging` DB, gitignored `.env.staging`), but the deployed unit is the **`api` service from the API-decoupling plan**, not a combined web+api container. The native release bakes the **API host** (new `API_SERVER_URL`/`VITE_API_HOSTNAME` vars): preview → staging API, production → prod API.

**Tech Stack:** Bun + `tko` CLI, uncloud (Docker Compose on a VPS), external managed PostgreSQL, Caddy (TLS), vxrn/One native bundler, Fastlane (TestFlight), vitest.

## Global Constraints

- **Prerequisites:** the **API Decoupling plan** (standalone `api` service, `API_SERVER_URL`/`VITE_API_HOSTNAME` env vars, `dist/api.js`) must be implemented first. This plan wires staging to that service.
- Reuse — do not duplicate — the shared deploy core and `.env.staging` scaffolding from `2026-07-17-staging-backend.md` (Tasks 2 and 3 there). If that plan has NOT been executed, execute its Tasks 2–3 first (they are unchanged and still correct), then apply this plan's deltas.
- `createEnv` supports only `development`/`production` modes — staging runs as `NODE_ENV=production` with staging values. Do NOT add a `staging` mode.
- `.env.staging` holds secrets — gitignored, never committed.
- Production behaviour unchanged: `bun tko uncloud deploy-prod` must still resolve the prod host/context/env.
- Bundle IDs fixed: preview `uk.co.curatormtd.preview`, production `uk.co.curatormtd.app`; URL scheme shared `curatormtd`.
- `console.info()`; few lowercase comments; `~` alias in `src/`, relative in `scripts/*`; Conventional Commits, lowercase, one line, no co-author.

---

## File Structure

**Modified files:**
- `scripts/release/helpers/env.ts` — `resolveBundleServerEnv` also resolves + bakes `API_SERVER_URL`/`VITE_API_HOSTNAME` per variant.
- `scripts/release/helpers/env.test.ts` — extend for the API-host resolution.
- `scripts/release/helpers/run-release.ts` — apply the api-host bundle env.
- `.env.staging.example` — add `API_SERVER_URL`/`VITE_API_HOSTNAME`, point HMRC/Plaid/auth at the api host.
- `scripts/uncloud/deploy-staging.ts` (from the staging-backend plan) — deploy the `api` service (+ worker), not `web`.
- `docs/staging.md` / `docs/api-service.md` — document the staging API.

---

## Task 1: Bundle the API host per variant

**Files:**
- Modify: `scripts/release/helpers/env.ts` (`resolveBundleServerEnv`)
- Modify: `scripts/release/helpers/run-release.ts`
- Test: `scripts/release/helpers/env.test.ts`

**Interfaces:**
- Produces (extended): `resolveBundleServerEnv(cwd, variant)` now also returns `apiServerUrl: string`, `apiHostname: string`, and includes `API_SERVER_URL` + `VITE_API_HOSTNAME` (+ `VITE_PROTOCOL`) in `bundleEnv`.
- Precedence: `process.env` wins, then the variant's env file (`preview` → `.env.staging` ONLY, never falling back to production; `production` → `.env.production`). A preview build that resolves no staging url throws, rather than silently baking `localhost`/prod.

- [ ] **Step 1: Extend the failing test**

Add to `scripts/release/helpers/env.test.ts`:

```ts
  it('bakes the staging api host for the preview variant', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'ONE_SERVER_URL=https://app.curatormtd.co.uk\nAPI_SERVER_URL=https://api.curatormtd.co.uk\nVITE_API_HOSTNAME=api.curatormtd.co.uk\n',
    )
    writeFileSync(
      join(dir, '.env.staging'),
      'ONE_SERVER_URL=https://staging.curatormtd.co.uk\nAPI_SERVER_URL=https://staging-api.curatormtd.co.uk\nVITE_API_HOSTNAME=staging-api.curatormtd.co.uk\n',
    )
    const res = resolveBundleServerEnv(dir, 'preview')
    expect(res.apiServerUrl).toBe('https://staging-api.curatormtd.co.uk')
    expect(res.bundleEnv.API_SERVER_URL).toBe('https://staging-api.curatormtd.co.uk')
    expect(res.bundleEnv.VITE_API_HOSTNAME).toBe('staging-api.curatormtd.co.uk')
  })

  it('bakes the prod api host for the production variant', () => {
    writeFileSync(
      join(dir, '.env.production'),
      'API_SERVER_URL=https://api.curatormtd.co.uk\nVITE_API_HOSTNAME=api.curatormtd.co.uk\n',
    )
    const res = resolveBundleServerEnv(dir, 'production')
    expect(res.apiServerUrl).toBe('https://api.curatormtd.co.uk')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts scripts/release/helpers/env.test.ts`
Expected: FAIL — `resolveBundleServerEnv` does not yet return `apiServerUrl` or bake `API_SERVER_URL`.

- [ ] **Step 3: Extend `resolveBundleServerEnv`**

In `scripts/release/helpers/env.ts`, after the existing `serverUrl`/`webHostname` resolution, add the api-host resolution and return fields:

```ts
  const apiServerUrl = process.env.API_SERVER_URL || fileEnv.API_SERVER_URL || ''
  const apiHostname =
    process.env.VITE_API_HOSTNAME ||
    fileEnv.VITE_API_HOSTNAME ||
    apiServerUrl.replace(/^https?:\/\//, '')

  if (apiServerUrl) bundleEnv.API_SERVER_URL = apiServerUrl
  if (apiHostname) {
    bundleEnv.VITE_API_HOSTNAME = apiHostname
    bundleEnv.VITE_PROTOCOL = webProtocol
  }
```

Update the function's return type and `return` object to include `apiServerUrl` and `apiHostname`.

- [ ] **Step 4: Use it in run-release**

In `scripts/release/helpers/run-release.ts`, the existing `applyEnv(bundleEnv)` already applies the whole `bundleEnv`, so `API_SERVER_URL`/`VITE_API_HOSTNAME` are picked up automatically. Update the info log to also print the api host:

```ts
  const displayApi = apiServerUrl || (apiHostname ? `${webProtocol}://${apiHostname}` : '')
  if (displayApi) console.info(colors.gray(`  api url: ${displayApi}`))
```

(destructure `apiServerUrl`, `apiHostname` from the `resolveBundleServerEnv` call.)

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts scripts/release/helpers/env.test.ts && bun tko check types && bun lint:fix`
Expected: all tests pass; no new errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/release/helpers/env.ts scripts/release/helpers/env.test.ts scripts/release/helpers/run-release.ts
git commit -m "feat(release): bake api host per variant into native bundle"
```

---

## Task 2: Point staging env + integrations at the API host

**Files:**
- Modify: `.env.staging.example`, local `.env.staging`

**Interfaces:**
- Produces: staging config where the app talks to `https://staging-api.curatormtd.co.uk`, auth/HMRC/Plaid callbacks resolve to that host, and the DB is `curatormtd_staging`.

- [ ] **Step 1: Update `.env.staging.example`**

Add/adjust these keys (keeping the rest of the template from the staging-backend plan):

```bash
# ---- app/api urls (staging: api-only, no web app shipped) ----
API_SERVER_URL=https://staging-api.curatormtd.co.uk
VITE_API_HOSTNAME=staging-api.curatormtd.co.uk
BETTER_AUTH_URL=https://staging-api.curatormtd.co.uk
VITE_PROTOCOL=https
# ONE_SERVER_URL/VITE_WEB_HOSTNAME kept for the (unshipped) web app; can mirror api host
ONE_SERVER_URL=https://staging-api.curatormtd.co.uk
VITE_WEB_HOSTNAME=staging-api.curatormtd.co.uk

# ---- integrations point at the api host ----
HMRC_REDIRECT_URI=https://staging-api.curatormtd.co.uk/api/hmrc/callback
```

- [ ] **Step 2: Update local `.env.staging`**

Mirror the same api-host values into the (gitignored) `.env.staging`. Verify:

Run:
```bash
bun -e "import('@dotenvx/dotenvx').then(d=>{d.config({path:'.env.staging'});console.info(process.env.API_SERVER_URL, process.env.BETTER_AUTH_URL, process.env.DATABASE_URL?.includes('curatormtd_staging'));})"
```
Expected: `https://staging-api.curatormtd.co.uk https://staging-api.curatormtd.co.uk true`.

- [ ] **Step 3: Register the staging HMRC redirect URI**

In the HMRC Developer Hub sandbox app, add `https://staging-api.curatormtd.co.uk/api/hmrc/callback` (native deep link `curatormtd://hmrc/callback` already shared). External config — no commit.

- [ ] **Step 4: Commit the example only**

```bash
git add .env.staging.example
git commit -m "chore(env): point staging config at the api host"
```

---

## Task 3: Deploy the `api` service to staging (DNS + deploy)

**Files:**
- Modify: `scripts/uncloud/deploy-staging.ts` (from the staging-backend plan) — ensure it deploys `api` (+ `worker`)

- [ ] **Step 1: Create the staging API DNS record**

Add A record `staging-api.curatormtd.co.uk` → `<staging-vm-ip>` (Cloudflare). Mirror prod's proxy/Origin-CA choice.

Run: `dig +short staging-api.curatormtd.co.uk`
Expected: the staging VM IP.

- [ ] **Step 2: Ensure the staging deploy targets the `api` service**

In the deploy core / `deploy-staging.ts`, the deployed services list should be `['api', 'worker']` (no `web`, since staging ships api-only). The compose `api` service's `x-ports` uses `${VITE_API_HOSTNAME}` (from `.env.staging`), so it binds `staging-api.curatormtd.co.uk` automatically.

- [ ] **Step 3: Deploy staging**

Run: `bun tko uncloud deploy-staging`
Expected: builds the image (with `dist/api.js`), runs migrations against `curatormtd_staging` (`[database] migrations complete`), deploys `api` + `worker` to the `staging` context, prints the api url.

- [ ] **Step 4: Verify reachable + isolated**

Run: `curl -fsS https://staging-api.curatormtd.co.uk/api/health`
Expected: HTTP 200 with the deployed `GIT_SHA`.
Run: `curl -fsS "https://staging-api.curatormtd.co.uk/api/v1/handshake" -H "x-app-version: 0.0.0"`
Expected: `{"status":"ok","apiContract":1,...}`.
Confirm DB isolation:
Run: `psql "$DEPLOY_DB" -c "SELECT count(*) FROM \"user\";"` (staging `DEPLOY_DB`)
Expected: 0 or staging-only rows.

- [ ] **Step 5: Confirm prod untouched**

Run: `curl -fsS https://api.curatormtd.co.uk/api/health` (once prod api is deployed) and `bun tko uncloud check-deployment`
Expected: prod healthy.

- [ ] **Step 6: Commit**

```bash
git add scripts/uncloud/*.ts
git commit -m "feat(deploy): deploy standalone api to staging"
```

---

## Task 4: Build the preview app against the staging API + verify end-to-end

**Files:** none (uses Task 1's wiring)

- [ ] **Step 1: Build preview (no upload)**

Run: `bun tko release preview --skip-upload --ios`
Expected: release log prints `api url: https://staging-api.curatormtd.co.uk`.

- [ ] **Step 2: Verify the bundle baked the staging api host**

Run:
```bash
rg -oa "api\.staging\.curatormtd\.co\.uk|api\.curatormtd\.co\.uk|localhost:8081" \
  ~/Library/Developer/Xcode/DerivedData/CuratorMTDPreview-*/Build/**/main.jsbundle | sort | uniq -c
```
Expected: `staging-api.curatormtd.co.uk` present; prod api host absent as the base; `localhost:8081` only as fallback strings.

- [ ] **Step 3: Upload + smoke-test**

Run: `bun tko release preview --ios`
Install via TestFlight and confirm: no repeated "AuthError: Network request failed" toast, sign-up/login works against the staging API, handshake returns `ok`, and data created in preview does NOT appear in production.

- [ ] **Step 4: (No commit — build/ops verification only)**

---

## Task 5: Documentation

**Files:**
- Modify: `docs/staging.md` (from the staging-backend plan) and `docs/api-service.md`

- [ ] **Step 1: Update the runbooks**

In `docs/staging.md`: staging is now **api-only** at `staging-api.curatormtd.co.uk` (no web app), deployed via `bun tko uncloud deploy-staging` which ships the `api` + `worker` services; preview builds auto-target the staging api via `API_SERVER_URL`/`VITE_API_HOSTNAME`. In `docs/api-service.md`: add the staging vs prod host table (`staging-api.curatormtd.co.uk` ↔ preview, `api.curatormtd.co.uk` ↔ production).

- [ ] **Step 2: Commit**

```bash
git add docs/staging.md docs/api-service.md
git commit -m "docs: document api-only staging environment"
```

---

## Risks & Notes

- **Supersedes the web-coupled staging plan:** where `2026-07-17-staging-backend.md` deploys `web`, this plan deploys `api`. Its Tasks 2 (`.env.staging` scaffolding) and 3 (shared `deploy-core`) are still reused verbatim; only the deployed service and the baked host differ.
- **Web app later:** if/when the web app ships to staging, add a `web` service + `staging.curatormtd.co.uk` DNS; the api stays on its own subdomain.
- **crossSubDomainCookies:** the `.curatormtd.co.uk` cookie-domain fix (API-decoupling plan Task 6.5) covers `api.staging.` ↔ `staging.` too; verify when web staging is introduced.
- **Cost:** dedicated staging VM is an always-on cost (same note as the original staging plan).

## Self-Review

- Spec coverage: per-variant api-host baking (Task 1), staging env/integrations at api host (Task 2), staging api deploy + DNS + isolation (Task 3), preview end-to-end (Task 4), docs (Task 5). Reuses the unchanged `.env.staging`/deploy-core work from the prior staging plan.
- Placeholder scan: full code/commands; infra values (VM IP, DB creds) are explicitly user-supplied.
- Type consistency: `resolveBundleServerEnv` extended return (`apiServerUrl`, `apiHostname`, `bundleEnv.API_SERVER_URL`) consistent across Task 1 definition, test, and run-release call site.
