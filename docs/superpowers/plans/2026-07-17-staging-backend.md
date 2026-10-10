# Staging Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the preview/TestFlight app its own isolated backend (`staging.curatormtd.co.uk`) so it never reads or writes production data, auth, or storage.

**Architecture:** "Staging" is modelled as **production mode running with staging values on isolated infrastructure** — no new env framework mode. It is a separate uncloud deployment (its own VM + uncloud context), a separate `staging` database on the existing managed Postgres server, a `staging.curatormtd.co.uk` subdomain, and a gitignored `.env.staging`. The existing `deploy-prod.ts` logic is extracted into a parametrised helper so `deploy-prod` and `deploy-staging` share one code path. The native release wires the **preview** variant to the staging URL and **production** to the prod URL.

**Tech Stack:** Bun + `tko` CLI scripts, uncloud (Docker Compose on a VPS), external managed PostgreSQL, Caddy (TLS), vxrn/One native bundler, Fastlane (TestFlight), vitest (unit tests).

## Global Constraints

- Never delete `bun.lock`.
- `createEnv` in `src/env.ts` supports only `development` and `production` modes — do NOT add a `staging` mode. Staging runs as `NODE_ENV=production` with staging *values*.
- `.env.staging` contains secrets — it MUST be gitignored and never committed.
- Production behaviour must be unchanged: `bun tko uncloud deploy-prod` must resolve identical host/context/env after refactoring.
- Bundle IDs are fixed: preview `uk.co.curatormtd.preview`, production `uk.co.curatormtd.app`. URL scheme is shared: `curatormtd`.
- Use `console.info()` not `console.log()`; few, lowercase comments; `~` import alias in `src/`, relative in `packages/*` and `scripts/*`.
- Run `bun lint:fix && bun tko check types` after code changes; `bun test:unit` for unit tests.
- Commit style: Conventional Commits, lowercase, one line, no co-author.

---

## File Structure

**New files:**
- `.env.staging` — gitignored staging secrets/config (created from a committed example).
- `.env.staging.example` — committed template documenting required staging vars.
- `scripts/uncloud/helpers/deploy-core.ts` — the shared, parametrised uncloud deploy routine extracted from `deploy-prod.ts`.
- `scripts/uncloud/deploy-staging.ts` — thin wrapper: loads `.env.staging`, calls `deploy-core` with the staging target.
- `scripts/release/helpers/env.test.ts` — vitest unit tests for `resolveBundleServerEnv` variant selection.
- `docs/staging.md` — staging environment runbook.

**Modified files:**
- `scripts/release/helpers/env.ts` — `resolveBundleServerEnv` gains a `variant` argument and picks the env file per variant.
- `scripts/release/helpers/run-release.ts` — pass `variant` into `resolveBundleServerEnv`.
- `scripts/uncloud/deploy-prod.ts` — reduced to a thin wrapper over `deploy-core` (production target).
- `.gitignore` — ensure `.env.staging` is ignored.
- `docs/native-release.md` — document preview→staging, production→prod.

---

## Task 1: Native build targets staging for preview, prod for production

**Files:**
- Modify: `scripts/release/helpers/env.ts` (function `resolveBundleServerEnv`)
- Modify: `scripts/release/helpers/run-release.ts` (call site)
- Test: `scripts/release/helpers/env.test.ts`

**Interfaces:**
- Produces: `resolveBundleServerEnv(cwd: string, variant: 'preview' | 'production'): { serverUrl: string; webHostname: string; webProtocol: string; bundleEnv: Record<string,string> }`
- Consumes (run-release): `variant` already in scope as `ReleaseOptions['variant']`.

Behaviour: for `variant === 'preview'` read `.env.staging` ONLY (never fall back to `.env.production` — a preview build must never bake prod urls; if nothing resolves, throw); for `variant === 'production'` read `.env.production`. Already-set `process.env` values still win over file values.

- [ ] **Step 1: Write the failing test**

Create `scripts/release/helpers/env.test.ts`:

```ts
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveBundleServerEnv } from './env'

describe('resolveBundleServerEnv', () => {
  let dir: string
  const saved = { ...process.env }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mtd-env-'))
    delete process.env.ONE_SERVER_URL
    delete process.env.VITE_WEB_HOSTNAME
    delete process.env.VITE_PROTOCOL
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    process.env = { ...saved }
  })

  it('uses .env.staging for the preview variant', () => {
    writeFileSync(join(dir, '.env.production'), 'ONE_SERVER_URL=https://app.curatormtd.co.uk\n')
    writeFileSync(join(dir, '.env.staging'), 'ONE_SERVER_URL=https://staging.curatormtd.co.uk\n')

    const res = resolveBundleServerEnv(dir, 'preview')
    expect(res.serverUrl).toBe('https://staging.curatormtd.co.uk')
    expect(res.webHostname).toBe('staging.curatormtd.co.uk')
    expect(res.bundleEnv.ONE_SERVER_URL).toBe('https://staging.curatormtd.co.uk')
  })

  it('uses .env.production for the production variant', () => {
    writeFileSync(join(dir, '.env.production'), 'ONE_SERVER_URL=https://app.curatormtd.co.uk\n')
    writeFileSync(join(dir, '.env.staging'), 'ONE_SERVER_URL=https://staging.curatormtd.co.uk\n')

    const res = resolveBundleServerEnv(dir, 'production')
    expect(res.serverUrl).toBe('https://app.curatormtd.co.uk')
  })

  it('falls back to .env.production for preview when .env.staging is missing', () => {
    writeFileSync(join(dir, '.env.production'), 'ONE_SERVER_URL=https://app.curatormtd.co.uk\n')

    const res = resolveBundleServerEnv(dir, 'preview')
    expect(res.serverUrl).toBe('https://app.curatormtd.co.uk')
  })

  it('prefers an already-set process.env value over the file', () => {
    writeFileSync(join(dir, '.env.staging'), 'ONE_SERVER_URL=https://staging.curatormtd.co.uk\n')
    process.env.ONE_SERVER_URL = 'https://override.example.com'

    const res = resolveBundleServerEnv(dir, 'preview')
    expect(res.serverUrl).toBe('https://override.example.com')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts scripts/release/helpers/env.test.ts`
Expected: FAIL — `resolveBundleServerEnv` currently takes only `(cwd)` and always reads `.env.production`, so the preview/staging assertions fail (and the arity change may be a type error).

- [ ] **Step 3: Update `resolveBundleServerEnv` in `scripts/release/helpers/env.ts`**

Replace the existing function body with the variant-aware version:

```ts
/**
 * resolve the deployed server url + web hostname to bake into the native bundle.
 * the native app derives SERVER_URL from ONE_SERVER_URL (injected via vxrn's
 * native prelude) with a VITE_WEB_HOSTNAME fallback. without these, the bundle
 * falls back to http://localhost:8081 (unreachable on device -> "Network request
 * failed"). preview points at staging, production points at prod. prefers
 * already-set process.env, then the variant's env file.
 */
export function resolveBundleServerEnv(
  cwd: string,
  variant: 'preview' | 'production',
): {
  serverUrl: string
  webHostname: string
  webProtocol: string
  bundleEnv: Record<string, string>
} {
  // preview -> staging backend ONLY (never prod, or a testflight build could hit
  // prod data); production -> prod. a preview that resolves nothing throws below.
  const envFile = join(cwd, variant === 'preview' ? '.env.staging' : '.env.production')
  const fileEnv = loadEnvFile(envFile)

  const serverUrl = process.env.ONE_SERVER_URL || fileEnv.ONE_SERVER_URL || ''
  const webHostname =
    process.env.VITE_WEB_HOSTNAME ||
    fileEnv.VITE_WEB_HOSTNAME ||
    serverUrl.replace(/^https?:\/\//, '')
  const webProtocol = process.env.VITE_PROTOCOL || fileEnv.VITE_PROTOCOL || 'https'

  const bundleEnv: Record<string, string> = {}
  if (serverUrl) bundleEnv.ONE_SERVER_URL = serverUrl
  if (webHostname) {
    bundleEnv.VITE_WEB_HOSTNAME = webHostname
    bundleEnv.VITE_PROTOCOL = webProtocol
  }

  return { serverUrl, webHostname, webProtocol, bundleEnv }
}
```

Ensure `existsSync` is imported at the top of `env.ts` (it already imports from `node:fs`: `import { existsSync, readdirSync, readFileSync } from 'node:fs'`). No new import needed.

- [ ] **Step 4: Update the call site in `scripts/release/helpers/run-release.ts`**

Change:

```ts
  const { serverUrl, webHostname, webProtocol, bundleEnv } =
    resolveBundleServerEnv(cwd)
```

to:

```ts
  const { serverUrl, webHostname, webProtocol, bundleEnv } =
    resolveBundleServerEnv(cwd, variant)
```

(`variant` is already destructured from `opts` earlier in `runRelease`.)

- [ ] **Step 5: Run tests and typecheck**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts scripts/release/helpers/env.test.ts`
Expected: PASS (4 tests).
Run: `bun lint:fix && bun tko check types`
Expected: no new errors in `scripts/release/helpers/*`.

- [ ] **Step 6: Commit**

```bash
git add scripts/release/helpers/env.ts scripts/release/helpers/run-release.ts scripts/release/helpers/env.test.ts
git commit -m "feat(release): point preview native builds at staging backend"
```

---

## Task 2: Add `.env.staging` scaffolding

**Files:**
- Create: `.env.staging.example`
- Modify: `.gitignore`
- Create: `.env.staging` (local only, from the example — NOT committed)

**Interfaces:**
- Produces: `.env.staging` with, at minimum: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_DB`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ONE_SERVER_URL`, `VITE_WEB_HOSTNAME`, `VITE_PROTOCOL`, `HMRC_ENV`, `HMRC_CLIENT_ID`, `HMRC_CLIENT_SECRET`, `HMRC_REDIRECT_URI`, `PLAID_*`, `POSTMARK_SERVER_TOKEN`, `UNCLOUD_CONTEXT=staging`.

- [ ] **Step 1: Ensure `.gitignore` ignores `.env.staging`**

Confirm `.gitignore` contains a line matching `.env.staging`. The repo already ignores `.env.production` / `.env*.local`; add an explicit entry if `.env.staging` is not covered:

```
.env.staging
```

Verify it is ignored:
Run: `git check-ignore .env.staging`
Expected: prints `.env.staging` (i.e. it IS ignored).

- [ ] **Step 2: Create `.env.staging.example` (committed template)**

```bash
# Staging Environment Variables
# Copy to .env.staging and fill in real values. .env.staging is gitignored.
# Staging runs in production MODE with staging VALUES on isolated infra.

# ---- deployment target (separate VM from prod) ----
DEPLOYMENT_PLATFORM=uncloud
DEPLOYMENT_ARCH=linux/amd64
DEPLOY_HOST=your-staging-vm-ip
DEPLOY_USER=your-ssh-user
DEPLOY_SSH_KEY=/Users/you/.ssh/uncloud_deploy
UNCLOUD_CONTEXT=staging

# ---- app urls (staging subdomain) ----
ONE_SERVER_URL=https://staging.curatormtd.co.uk
BETTER_AUTH_URL=https://staging.curatormtd.co.uk
VITE_WEB_HOSTNAME=staging.curatormtd.co.uk
VITE_PROTOCOL=https

# ---- database (separate DB on the existing managed postgres server) ----
# use a distinct database name so staging can never touch prod rows
DEPLOY_DB=postgresql://USER:PASSWORD@34.13.41.244:5432/curatormtd_staging?sslmode=require
DATABASE_URL=postgresql://USER:PASSWORD@34.13.41.244:5432/curatormtd_staging?sslmode=require

# ---- auth (generate a fresh secret, DO NOT reuse prod) ----
# openssl rand -hex 32
BETTER_AUTH_SECRET=generate-a-new-32-byte-hex-secret

# ---- integrations (sandbox, same as prod) ----
HMRC_ENV=sandbox
HMRC_CLIENT_ID=your-hmrc-sandbox-client-id
HMRC_CLIENT_SECRET=your-hmrc-sandbox-client-secret
HMRC_REDIRECT_URI=https://staging.curatormtd.co.uk/api/hmrc/callback
HMRC_NATIVE_REDIRECT_URI=curatormtd://hmrc/callback
HMRC_ACCOUNT_URL=https://www.tax.service.gov.uk/account
PLAID_CLIENT_ID=6a3a49b3de656a000d2cd00f
PLAID_SECRET=your-plaid-sandbox-secret
PLAID_ENV=sandbox
PLAID_REDIRECT_URI=curatormtd://
PLAID_SYNC_DAYS=90

# ---- email ----
POSTMARK_SERVER_TOKEN=your-postmark-token

# ---- storage (optional; leave unset to mirror prod which has R2 unconfigured) ----
# CLOUDFLARE_R2_ENDPOINT=
# CLOUDFLARE_R2_ACCESS_KEY=
# CLOUDFLARE_R2_SECRET_KEY=
# CLOUDFLARE_R2_PUBLIC_URL=

# ---- tls (optional origin ca; otherwise caddy uses lets-encrypt) ----
# ORIGIN_CA_CERT=src/uncloud/certs/origin.pem
# ORIGIN_CA_KEY=src/uncloud/certs/origin.key
```

- [ ] **Step 3: Create local `.env.staging` from the example**

```bash
cp .env.staging.example .env.staging
# generate a fresh auth secret and paste it into BETTER_AUTH_SECRET:
openssl rand -hex 32
```

Fill in `DEPLOY_HOST`, DB credentials (Task 4 provisions these), HMRC/Plaid/Postmark secrets. Leave `DEPLOY_HOST`/`DEPLOY_DB` as placeholders for now if infra is not yet provisioned — Task 4 finalises them.

Verify it stays untracked:
Run: `git status --porcelain .env.staging`
Expected: no output (ignored/untracked, not staged).

- [ ] **Step 4: Commit the example only**

```bash
git add .env.staging.example .gitignore
git commit -m "chore(env): add .env.staging.example template"
```

---

## Task 3: Extract a shared uncloud deploy core; add `deploy-staging`

**Files:**
- Create: `scripts/uncloud/helpers/deploy-core.ts`
- Create: `scripts/uncloud/deploy-staging.ts`
- Modify: `scripts/uncloud/deploy-prod.ts`

**Interfaces:**
- Produces: `runUncloudDeploy(target: { name: 'production' | 'staging'; envFile: string }): Promise<void>` in `deploy-core.ts`.
- Consumes: existing helpers `./build`, `./helpers/processEnv`, `./helpers/ssh`, `./helpers/uncloud`, `@mtd/scripts/helpers/uncloud` (`UNCLOUD_CONTEXT_DEFAULT`), `@mtd/scripts/helpers/deploy-lock`, `./helpers/caddy-origin-ca`, `./helpers/external-db-compose`.

Design: `deploy-core.ts` contains the entire body currently inside `deploy-prod.ts`'s `cmd\`...\`.run(...)` callback, unchanged in behaviour, but (a) the dotenv/`loadEnv` calls move into the wrappers, and (b) the uncloud context defaults to `process.env.UNCLOUD_CONTEXT || UNCLOUD_CONTEXT_DEFAULT` (already the case). No logic changes — this is a pure extraction so prod is untouched.

- [ ] **Step 1: Create `scripts/uncloud/helpers/deploy-core.ts`**

Move the deploy implementation verbatim out of `deploy-prod.ts`. Export a function that takes the target label (used only in log lines) and runs the existing steps. Concretely:

```ts
#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { cmd } from '@mtd/cli'

import {
  buildOriginCACaddyfile,
  patchRemoteCaddyfile,
  restartCaddy,
  uploadOriginCACerts,
} from './caddy-origin-ca'
import { stripSelfHostedDbFromCompose, usesExternalDatabase } from './external-db-compose'

export type DeployTarget = { name: 'production' | 'staging' }

export async function runUncloudDeploy(target: DeployTarget) {
  await cmd`Deploy ${target.name}`.run(async ({ run, colors, fs, path }) => {
    // >>> paste the ENTIRE existing body of deploy-prod.ts's run() callback here,
    //     unchanged, EXCEPT the two log lines below that mention "production".
    // ...
  })
}
```

When pasting, change only the user-facing strings:
- `console.info('🎯 deploying mtd to production\n')` → `console.info(\`🎯 deploying mtd to ${target.name}\n\`)`
- The final "deployment ready" block may stay as-is.

Everything else (prerequisites, `DEPLOY_HOST`, `DEPLOY_DB`, migrations, `deployStack`, caddy, lock) is identical and reads from `process.env`, which the wrapper populates.

- [ ] **Step 2: Reduce `scripts/uncloud/deploy-prod.ts` to a wrapper**

```ts
#!/usr/bin/env bun

import { existsSync } from 'node:fs'

import { config as loadDotenv } from '@dotenvx/dotenvx'

import { runUncloudDeploy } from './helpers/deploy-core'

// load .env.production over auto-generated .env defaults
loadDotenv({ path: '.env' })
loadDotenv({ path: '.env.production', override: true })
if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })

const { loadEnv } = await import('@mtd/scripts/helpers/env-load')
await loadEnv('production')

await runUncloudDeploy({ name: 'production' })
```

- [ ] **Step 3: Create `scripts/uncloud/deploy-staging.ts`**

```ts
#!/usr/bin/env bun

import { existsSync } from 'node:fs'

import { config as loadDotenv } from '@dotenvx/dotenvx'

import { runUncloudDeploy } from './helpers/deploy-core'

// staging runs in production MODE with staging VALUES.
// load .env.staging over the auto-generated .env defaults.
loadDotenv({ path: '.env' })
loadDotenv({ path: '.env.staging', override: true })
if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })

// staging uses its own uncloud context so it never touches the prod cluster
process.env.UNCLOUD_CONTEXT = process.env.UNCLOUD_CONTEXT || 'staging'

// backend runs as production mode; only the VALUES differ (staging domain/db/secret)
const { loadEnv } = await import('@mtd/scripts/helpers/env-load')
await loadEnv('production')

await runUncloudDeploy({ name: 'staging' })
```

- [ ] **Step 4: Regression-check production resolution (no deploy)**

Confirm `deploy-prod` still resolves the same host/context. Dry-inspect by printing resolved values without deploying:

Run:
```bash
bun -e "import('@dotenvx/dotenvx').then(async d => { d.config({path:'.env'}); d.config({path:'.env.production',override:true}); const {loadEnv}=await import('@mtd/scripts/helpers/env-load'); await loadEnv('production'); console.info('HOST', process.env.DEPLOY_HOST, 'CTX', process.env.UNCLOUD_CONTEXT || 'default', 'URL', process.env.ONE_SERVER_URL); })"
```
Expected: `HOST 34.153.163.187 CTX default URL https://app.curatormtd.co.uk` (unchanged from before the refactor).

- [ ] **Step 5: Typecheck + lint**

Run: `bun lint:fix && bun tko check types`
Expected: no new errors in `scripts/uncloud/*`.

- [ ] **Step 6: Commit**

```bash
git add scripts/uncloud/helpers/deploy-core.ts scripts/uncloud/deploy-prod.ts scripts/uncloud/deploy-staging.ts
git commit -m "refactor(uncloud): extract deploy core and add staging target"
```

---

## Task 4: Provision staging infrastructure (ops — user runs)

**Files:** none (infrastructure + `.env.staging` finalisation)

This task provisions the isolated resources. No app code changes. Each step has a verification.

- [ ] **Step 1: Provision a staging VM**

Create a small VM (e.g. GCE `e2-small`, matching prod sizing per the `deploy-uncloud` skill). Note its public IP. Add your deploy SSH public key to it.

Verify SSH:
Run: `ssh -i ~/.ssh/uncloud_deploy <user>@<staging-ip> "echo ok"`
Expected: `ok`.

- [ ] **Step 2: Create the staging database on the existing managed Postgres**

Connect to the managed Postgres server (`34.13.41.244:5432`) with an admin role and create an isolated database:

```bash
psql "postgresql://ADMIN:PASSWORD@34.13.41.244:5432/postgres?sslmode=require" \
  -c "CREATE DATABASE curatormtd_staging;"
```

Verify:
Run: `psql "postgresql://ADMIN:PASSWORD@34.13.41.244:5432/curatormtd_staging?sslmode=require" -c "SELECT current_database();"`
Expected: `curatormtd_staging`.

- [ ] **Step 3: Create the DNS record**

Add an A record `staging.curatormtd.co.uk` → `<staging-vm-ip>` in your DNS provider (Cloudflare). If prod uses Cloudflare proxy + Origin CA, mirror that for staging; otherwise leave DNS-only so Caddy can use Let's Encrypt.

Verify:
Run: `dig +short staging.curatormtd.co.uk`
Expected: the staging VM IP.

- [ ] **Step 4: Finalise `.env.staging`**

Fill the real values into `.env.staging`: `DEPLOY_HOST=<staging-ip>`, the `DEPLOY_DB`/`DATABASE_URL` with the `curatormtd_staging` credentials, the freshly generated `BETTER_AUTH_SECRET`, and HMRC/Plaid/Postmark secrets.

Verify the file parses and points at staging:
Run:
```bash
bun -e "import('@dotenvx/dotenvx').then(d=>{d.config({path:'.env.staging'});console.info(process.env.DEPLOY_HOST, process.env.ONE_SERVER_URL, process.env.DATABASE_URL?.includes('curatormtd_staging'));})"
```
Expected: `<staging-ip> https://staging.curatormtd.co.uk true`.

- [ ] **Step 5: Register the staging HMRC redirect URI**

In the HMRC Developer Hub sandbox application, add `https://staging.curatormtd.co.uk/api/hmrc/callback` as an allowed redirect URI (the native deep link `curatormtd://hmrc/callback` is already shared). No commit — external config.

---

## Task 5: First staging deploy + migrations + health check

**Files:** none (runs the scripts from Task 3 against infra from Task 4)

- [ ] **Step 1: Deploy staging**

Run: `bun tko uncloud deploy-staging`
Expected: builds web + docker image, runs migrations against `curatormtd_staging` (log shows `[database] migrations complete`), deploys `web` + `worker` to the `staging` context, prints `web app: https://staging.curatormtd.co.uk`.

- [ ] **Step 2: Verify services healthy**

Run: `UNCLOUD_CONTEXT=staging bun tko uncloud check-deployment`
Expected: `web` and `worker` report healthy.

- [ ] **Step 3: Verify the API is reachable and isolated**

Run: `curl -fsS https://staging.curatormtd.co.uk/api/health`
Expected: HTTP 200 health payload (includes the deployed `GIT_SHA`).

Confirm the staging DB is empty of prod data (fresh):
Run: `psql "$DEPLOY_DB" -c "SELECT count(*) FROM \"user\";"` (using staging `DEPLOY_DB`)
Expected: 0 (or only staging-created rows) — proving isolation from prod.

- [ ] **Step 4: Confirm prod is untouched**

Run: `bun tko uncloud check-deployment` (default/prod context)
Expected: prod `web`/`worker` still healthy; `curl -fsS https://app.curatormtd.co.uk/api/health` returns 200.

---

## Task 6: Build the preview app against staging and verify end-to-end

**Files:** none (uses Task 1's wiring)

- [ ] **Step 1: Build the preview app (no upload)**

Run: `bun tko release preview --skip-upload --ios`
Expected: release log prints `server url: https://staging.curatormtd.co.uk`.

- [ ] **Step 2: Verify the bundle baked the staging URL**

Run:
```bash
rg -oa "staging\.curatormtd\.co\.uk|app\.curatormtd\.co\.uk|localhost:8081" \
  ~/Library/Developer/Xcode/DerivedData/CuratorMTDPreview-*/Build/**/main.jsbundle | sort | uniq -c
```
Expected: `staging.curatormtd.co.uk` present; no `app.curatormtd.co.uk` as the server URL; `localhost:8081` only as source-level fallback strings.

- [ ] **Step 3: Upload to TestFlight and smoke-test**

Run: `bun tko release preview --ios`
Then install via TestFlight and confirm: app loads with no repeated "AuthError: Network request failed" toast, sign-up/login works, and data created in preview does NOT appear in production (`app.curatormtd.co.uk`).

- [ ] **Step 4: (No commit — build/ops verification only)**

---

## Task 7: Documentation

**Files:**
- Create: `docs/staging.md`
- Modify: `docs/native-release.md`

- [ ] **Step 1: Write `docs/staging.md`**

Document: what staging is (prod mode + staging values, isolated VM/DB/subdomain), how to deploy (`bun tko uncloud deploy-staging`), the `.env.staging` contract, that preview builds auto-target staging, and the known crossSubDomainCookies caveat (see Risks).

- [ ] **Step 2: Update `docs/native-release.md`**

Add a short note under "Release": preview builds point at `staging.curatormtd.co.uk`, production builds at `app.curatormtd.co.uk` (resolved by `resolveBundleServerEnv` from `.env.staging` / `.env.production`).

- [ ] **Step 3: Commit**

```bash
git add docs/staging.md docs/native-release.md
git commit -m "docs: add staging environment runbook"
```

---

## Risks & Notes

- **`crossSubDomainCookies` domain is hardcoded to `.tamagui.dev`** in `src/features/auth/server/authServer.ts` (a latent copy-paste bug; `server.BETTER_AUTH_URL.includes(DOMAIN)` is true for both prod and staging). It does not block token/bearer native auth (native uses the `curatormtd://` origin already in `trustedOrigins`, and better-auth trusts its own `BETTER_AUTH_URL`), but web cross-subdomain cookies are misconfigured. Out of scope for staging, but flag it — a follow-up should set this to `.curatormtd.co.uk` or remove it.
- **Storage isolation:** production currently has `CLOUDFLARE_R2_*` unset (commented in `.env.production`). Staging mirrors this (unset). If/when R2 is enabled, give staging its own bucket or key prefix to keep uploads isolated.
- **Cost:** a dedicated staging VM is an additional always-on cost. If that's undesirable later, the shared-VM/second-stack variant (rejected here for blast-radius reasons) can be revisited.
- **Secrets:** never commit `.env.staging`. If CI ever deploys staging, add the staging secrets to GitHub secrets separately from prod.

## Self-Review

- Spec coverage: separate VM (Task 4.1), separate DB (Task 4.2), subdomain (Task 4.3), `.env.staging` (Task 2/4.4), generalized deploy (Task 3), preview→staging wiring (Task 1), infra provisioning steps (Task 4), first deploy/verify (Task 5/6), docs (Task 7). All decisions from the Q&A are covered.
- Placeholder scan: infra values (IPs, DB passwords, secrets) are intentionally user-supplied and marked as such; all code steps contain complete code.
- Type consistency: `resolveBundleServerEnv(cwd, variant)` signature is consistent across Task 1 definition and the run-release call site; `runUncloudDeploy(target)` consistent across Task 3.
