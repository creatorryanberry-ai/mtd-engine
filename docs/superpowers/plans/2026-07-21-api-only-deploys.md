# Api-only Deploys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production match staging — default deploy is `api` + `worker`; web is an independent command for both environments; prod env URLs mirror the API host until web ships.

**Architecture:** Extract shared env-loading + `--staging` parsing used by thin `deploy-api` / `deploy-web` wrappers. Reuse `runUncloudDeploy` (already skips the web build when `web` is absent). Keep `deploy-prod` / `deploy-staging` as aliases. Fix health checks to expect `api` + `worker`. Align `.env.production.example` with the staging URL pattern.

**Tech Stack:** Bun, `tko` file-based scripts under `scripts/uncloud/`, Uncloud + Docker Compose, vitest for pure helpers.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-api-only-deploys-design.md`
- Do not commit real `.env.production` / `.env.staging` secrets; update examples + document local edits
- Staging hostname stays `staging-api.curatormtd.co.uk`
- `app.curatormtd.co.uk` unused until a future `deploy-web`
- Prefer `console.info()`; few lowercase comments; Conventional Commits lowercase one-line, no co-author
- `tko` discovers scripts by path under `scripts/` — new files `deploy-api.ts` / `deploy-web.ts` become `bun tko uncloud deploy-api` / `deploy-web` automatically

---

## File Structure

**Create:**
- `scripts/uncloud/helpers/load-deploy-env.ts` — parse `--staging`; load prod or staging env (staging scrub preserved)
- `scripts/uncloud/helpers/load-deploy-env.test.ts` — unit tests for flag parsing + env key scrub list logic where pure
- `scripts/uncloud/deploy-api.ts` — default ship: `api` + `worker`
- `scripts/uncloud/deploy-web.ts` — web only

**Modify:**
- `scripts/uncloud/deploy-prod.ts` — alias → `deploy-api` (prod)
- `scripts/uncloud/deploy-staging.ts` — alias → `deploy-api --staging`
- `scripts/uncloud/helpers/deploy-core.ts` — comment update only (services already parametrized)
- `scripts/uncloud/check-deployment.ts` — expect `api` + `worker`; print api host
- `packages/scripts/src/helpers/deploy-health.ts` — HTTP health via `api` container by default
- `.env.production.example` — api-mirrored URLs like staging
- Docs/skills: `docs/deploy.md`, `docs/api-service.md`, `docs/architecture.md`, `docs/deploy-uncloud.md`, `docs/staging.md`, `README.md`, `.claude/skills/deploy/SKILL.md`, `.claude/skills/api-service/SKILL.md`, `.claude/skills/staging/SKILL.md`, `.claude/skills/deploy-uncloud/SKILL.md` (if present), `packages/cli/src/commands/onboard.ts` (hint text)

---

### Task 1: Shared deploy env loader + `--staging` flag

**Files:**
- Create: `scripts/uncloud/helpers/load-deploy-env.ts`
- Create: `scripts/uncloud/helpers/load-deploy-env.test.ts`

**Interfaces:**
- Produces:
  - `export type UncloudEnvTarget = 'production' | 'staging'`
  - `export function parseUncloudEnvTarget(argv: string[]): UncloudEnvTarget` — returns `'staging'` if `--staging` present, else `'production'`
  - `export async function loadUncloudDeployEnv(target: UncloudEnvTarget): Promise<void>` — mutates `process.env` the same way today's wrappers do

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { parseUncloudEnvTarget } from './load-deploy-env'

describe('parseUncloudEnvTarget', () => {
  it('defaults to production', () => {
    expect(parseUncloudEnvTarget([])).toBe('production')
    expect(parseUncloudEnvTarget(['--skip-build'])).toBe('production')
  })

  it('selects staging when --staging is present', () => {
    expect(parseUncloudEnvTarget(['--staging'])).toBe('staging')
    expect(parseUncloudEnvTarget(['--skip-build', '--staging'])).toBe('staging')
  })
})
```

- [ ] **Step 2: Run test — expect fail (module missing)**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts scripts/uncloud/helpers/load-deploy-env.test.ts`

Expected: FAIL (cannot resolve module / export)

- [ ] **Step 3: Implement loader**

Create `scripts/uncloud/helpers/load-deploy-env.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'

import { config as loadDotenv } from '@dotenvx/dotenvx'

export type UncloudEnvTarget = 'production' | 'staging'

export function parseUncloudEnvTarget(argv: string[] = process.argv.slice(2)): UncloudEnvTarget {
  return argv.includes('--staging') ? 'staging' : 'production'
}

function envFileKeys(path: string): string[] {
  if (!existsSync(path)) return []
  const keys: string[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_]\w*)\s*=/.exec(line)
    if (match) keys.push(match[1]!)
  }
  return keys
}

/** load env for an uncloud deploy. staging scrub matches deploy-staging.ts today. */
export async function loadUncloudDeployEnv(target: UncloudEnvTarget): Promise<void> {
  if (target === 'production') {
    loadDotenv({ path: '.env' })
    loadDotenv({ path: '.env.production', override: true })
    if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })
    const { loadEnv } = await import('@mtd/scripts/helpers/env-load')
    await loadEnv('production')
    return
  }

  // staging: production MODE + staging VALUES; scrub prod-only keys
  loadDotenv({ path: '.env' })
  loadDotenv({ path: '.env.staging', override: true })
  if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })
  process.env.UNCLOUD_CONTEXT = process.env.UNCLOUD_CONTEXT || 'staging'

  const stagingKeys = new Set([
    ...envFileKeys('.env'),
    ...envFileKeys('.env.staging'),
    ...envFileKeys('.env.local'),
  ])
  const prodOnlyKeys = envFileKeys('.env.production').filter((k) => !stagingKeys.has(k))

  const { loadEnv } = await import('@mtd/scripts/helpers/env-load')
  await loadEnv('production')

  for (const key of prodOnlyKeys) delete process.env[key]

  loadDotenv({ path: '.env.staging', override: true })
  if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })
  process.env.UNCLOUD_CONTEXT = process.env.UNCLOUD_CONTEXT || 'staging'
}
```

- [ ] **Step 4: Re-run tests — expect pass**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts scripts/uncloud/helpers/load-deploy-env.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/uncloud/helpers/load-deploy-env.ts scripts/uncloud/helpers/load-deploy-env.test.ts
git commit -m "feat: extract uncloud deploy env loader with --staging flag"
```

---

### Task 2: `deploy-api` + aliases for `deploy-prod` / `deploy-staging`

**Files:**
- Create: `scripts/uncloud/deploy-api.ts`
- Modify: `scripts/uncloud/deploy-prod.ts`
- Modify: `scripts/uncloud/deploy-staging.ts`
- Modify: `scripts/uncloud/helpers/deploy-core.ts` (comment only — change the outdated “prod ships web+api+worker” note)

**Interfaces:**
- Consumes: `loadUncloudDeployEnv`, `parseUncloudEnvTarget`, `runUncloudDeploy`
- Produces: `bun tko uncloud deploy-api` / `deploy-api --staging` ships `['api', 'worker']`

- [ ] **Step 1: Create `deploy-api.ts`**

```ts
#!/usr/bin/env bun

import { runUncloudDeploy } from './helpers/deploy-core'
import {
  loadUncloudDeployEnv,
  parseUncloudEnvTarget,
} from './helpers/load-deploy-env'

const target = parseUncloudEnvTarget()
await loadUncloudDeployEnv(target)

// default backend ship: api + worker (web is deploy-web)
await runUncloudDeploy({ name: target, services: ['api', 'worker'] })
```

- [ ] **Step 2: Replace `deploy-prod.ts` with alias**

```ts
#!/usr/bin/env bun

// alias: prefer `bun tko uncloud deploy-api`
import './deploy-api.ts'
```

- [ ] **Step 3: Replace `deploy-staging.ts` with alias that injects `--staging`**

```ts
#!/usr/bin/env bun

// alias: prefer `bun tko uncloud deploy-api --staging`
if (!process.argv.includes('--staging')) {
  process.argv.push('--staging')
}
await import('./deploy-api.ts')
```

- [ ] **Step 4: Update deploy-core comment**

In `scripts/uncloud/helpers/deploy-core.ts`, change the `DeployTarget` comment to:

```ts
  // services to deploy, in order. default ship is api+worker; web is optional via deploy-web.
  services: DeployableService[]
```

- [ ] **Step 5: Smoke-check CLI discovery (no deploy)**

Run: `bun tko uncloud deploy-api --help`  
(or whatever help path exists — if deploy-core only prints help for unknown flags, run with intercept / dry print)

At minimum confirm the script loads:

```bash
bun -e 'await import("./scripts/uncloud/helpers/load-deploy-env.ts"); console.info("ok")'
```

Expected: no throw

- [ ] **Step 6: Commit**

```bash
git add scripts/uncloud/deploy-api.ts scripts/uncloud/deploy-prod.ts scripts/uncloud/deploy-staging.ts scripts/uncloud/helpers/deploy-core.ts
git commit -m "feat: add deploy-api; keep deploy-prod/staging as aliases"
```

---

### Task 3: `deploy-web` (independent web ship)

**Files:**
- Create: `scripts/uncloud/deploy-web.ts`

**Interfaces:**
- Consumes: same loader + `runUncloudDeploy`
- Produces: `services: ['web']` only (triggers `buildWeb` + `WEB_DIST_REQUIRED` via existing `shipsWeb` path)

- [ ] **Step 1: Create `deploy-web.ts`**

```ts
#!/usr/bin/env bun

import { runUncloudDeploy } from './helpers/deploy-core'
import {
  loadUncloudDeployEnv,
  parseUncloudEnvTarget,
} from './helpers/load-deploy-env'

const target = parseUncloudEnvTarget()
await loadUncloudDeployEnv(target)

// web is independent of api+worker — do not include them here
await runUncloudDeploy({ name: target, services: ['web'] })
```

- [ ] **Step 2: Commit**

```bash
git add scripts/uncloud/deploy-web.ts
git commit -m "feat: add deploy-web for independent web releases"
```

---

### Task 4: Health check expects api + worker

**Files:**
- Modify: `scripts/uncloud/check-deployment.ts`
- Modify: `packages/scripts/src/helpers/deploy-health.ts`

**Interfaces:**
- `checkHttpHealth` default `containerFilter` becomes `'api'` (not `'web'`)
- `expectedServices` becomes `['api', 'worker']`
- Success banner prints api host via `VITE_API_HOSTNAME`

- [ ] **Step 1: Update `deploy-health.ts` default filter**

In `checkHttpHealth`, change:

```ts
  const containerFilter = options?.containerFilter || 'api'
```

and update the “web container not found” message to `'api container not found'` (or keep generic: `` `${containerFilter} container not found` ``).

- [ ] **Step 2: Update `check-deployment.ts`**

Replace:

```ts
    const expectedServices = ['web', 'worker']
```

with:

```ts
    const expectedServices = ['api', 'worker']
```

In `checkHttpHealth` call site, pass the api filter explicitly if desired:

```ts
  async function checkHttpHealth() {
    return checkHttpHealthHelper(sshCtx, {
      endpoint: 'http://localhost:8081/api/health',
      containerFilter: 'api',
    })
  }
```

In the success print block, replace web host messaging with:

```ts
          const apiHost = process.env.VITE_API_HOSTNAME || deployHost
          console.info(`  api:  https://${apiHost}`)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/uncloud/check-deployment.ts packages/scripts/src/helpers/deploy-health.ts
git commit -m "fix: expect api+worker in uncloud health checks"
```

---

### Task 5: Align production env example + document local `.env.production`

**Files:**
- Modify: `.env.production.example`
- (Local only, do not commit): `.env.production`

- [ ] **Step 1: Update `.env.production.example` application URLs section**

Replace the APPLICATION URLs block so it matches the staging pattern (api-first; web reserved):

```bash
# ============================================================================
# APPLICATION URLs (api-only until web ships)
# ============================================================================

# Standalone api host — native app + better-auth live here
API_SERVER_URL=https://api.curatormtd.co.uk
VITE_API_HOSTNAME=api.curatormtd.co.uk
BETTER_AUTH_URL=https://api.curatormtd.co.uk
VITE_PROTOCOL=https

# Mirror api until web ships. When deploying web later, set these to
# https://app.curatormtd.co.uk / app.curatormtd.co.uk and run:
#   bun tko uncloud deploy-web
ONE_SERVER_URL=https://api.curatormtd.co.uk
VITE_WEB_HOSTNAME=api.curatormtd.co.uk

# HMRC callback on the api host
HMRC_REDIRECT_URI=https://api.curatormtd.co.uk/api/hmrc/callback
HMRC_NATIVE_REDIRECT_URI=curatormtd://hmrc/callback
```

Leave `ALLOW_PUBLIC_AUTH` / `VITE_ALLOW_PUBLIC_AUTH` commented off (prod gates stay closed).

- [ ] **Step 2: Update local `.env.production` (operator, not committed)**

Align real values with the example (especially `BETTER_AUTH_URL`, `ONE_SERVER_URL`, `VITE_WEB_HOSTNAME`, `HMRC_REDIRECT_URI` → api host). Confirm with:

```bash
bun -e '
import { loadEnvFile } from "./scripts/release/helpers/env.ts"
const e = loadEnvFile(".env.production")
for (const k of ["API_SERVER_URL","VITE_API_HOSTNAME","BETTER_AUTH_URL","ONE_SERVER_URL","VITE_WEB_HOSTNAME","HMRC_REDIRECT_URI"]) {
  console.info(k, e[k] || "(unset)")
}
'
```

Expected: all api-host values; no `app.curatormtd.co.uk` until web ships.

- [ ] **Step 3: Commit example only**

```bash
git add .env.production.example
git commit -m "docs: align production env example with api-only hosts"
```

---

### Task 6: Docs, skills, onboard hints

**Files:**
- Modify: `docs/deploy.md`, `docs/api-service.md`, `docs/architecture.md`, `docs/deploy-uncloud.md`, `docs/staging.md`, `README.md`
- Modify matching skills under `.claude/skills/` (`deploy`, `api-service`, `staging`, `deploy-uncloud` if present)
- Modify: `packages/cli/src/commands/onboard.ts` (replace `deploy-prod` hint with `deploy-api`)

- [ ] **Step 1: Update README deploy section**

```bash
bun tko uncloud deploy-api              # production: api + worker
bun tko uncloud deploy-api --staging    # staging: api + worker
bun tko uncloud deploy-web              # production web only (deferred)
bun tko uncloud deploy-web --staging    # staging web only (deferred)
# aliases: deploy-prod → deploy-api; deploy-staging → deploy-api --staging
```

- [ ] **Step 2: Update `docs/deploy.md` / `docs/api-service.md` / `docs/architecture.md` / `docs/staging.md` / `docs/deploy-uncloud.md`**

Key claims to fix everywhere:
- Production default is **api + worker**, not web+api+worker
- Web is independent via `deploy-web`
- Aliases still work
- Health: `curl -fsS https://api.curatormtd.co.uk/api/health`

- [ ] **Step 3: Mirror the same wording into `.claude/skills/*`**

Skills are often copies of docs — keep them in sync.

- [ ] **Step 4: Onboard hint**

In `packages/cli/src/commands/onboard.ts`, change the printed deploy command from `bun tko uncloud deploy-prod` to `bun tko uncloud deploy-api`.

- [ ] **Step 5: Commit**

```bash
git add docs README.md .claude/skills packages/cli/src/commands/onboard.ts
git commit -m "docs: document api-only deploys and independent web"
```

---

### Task 7: Cutover notes (manual, no code)

**Files:** none (operator checklist)

- [ ] **Step 1: After first `deploy-api` to prod**, verify:

```bash
curl -fsS https://api.curatormtd.co.uk/api/health
curl -fsS https://api.curatormtd.co.uk/api/v1/handshake -H "x-app-version: 0.0.0"
```

- [ ] **Step 2: If an old `web` service is still running on the prod cluster**, remove it once via Uncloud (`uc rm web` or equivalent) so it does not keep serving stale traffic. Do **not** automate this in the deploy script.

- [ ] **Step 3: Native production release** can proceed with existing `bun tko release production` once `.env.production` is api-mirrored (Task 5).

No commit for this task.

---

## Spec coverage self-review

| Spec requirement | Task |
|---|---|
| Default ship api+worker both envs | Task 2 |
| Independent `deploy-web` (+ `--staging`) | Task 3 |
| Explicit `deploy-api` (+ `--staging`) | Task 2 |
| Aliases `deploy-prod` / `deploy-staging` | Task 2 |
| Prod URLs mirror api host; `app.` unused | Task 5 |
| Reuse deploy-core | Tasks 2–3 |
| Health expects api+worker | Task 4 |
| Docs/skills update | Task 6 |
| One-time remove leftover web | Task 7 |
| Native release mechanism unchanged | (no code; Task 5 env only) |

## Placeholder scan

No TBD / “implement later” / vague validation steps remaining.

## Type consistency

- `UncloudEnvTarget` = `'production' | 'staging'` matches `DeployTarget['name']`
- `services: ['api', 'worker']` / `['web']` match `DeployableService`
