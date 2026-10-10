# Separate Staging Postgres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point staging at its own managed Postgres instance (different host from production), guard staging deploys against the prod DB host, and update lasting docs.

**Architecture:** Add a pure assert helper that refuses staging deploys when `DEPLOY_DB`/`DATABASE_URL` host matches production’s Postgres host (from `.env.production` plus a committed fallback IP). Wire it into `deploy-api` for `--staging` only.

**Tech Stack:** Bun, vitest, Uncloud deploy scripts under `scripts/uncloud/`, managed Postgres (same provider as prod), dotenvx env files.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-separate-staging-postgres-design.md`
- Do not commit real `.env.staging` / `.env.production` secrets; update examples + local/Bitwarden only
- Prefer `console.info()`; few lowercase comments; Conventional Commits lowercase one-line, no co-author
- Do not edit historical plans under `docs/superpowers/plans/2026-07-17-*` for copy cleanup

---

## File Structure

**Create:**
- `scripts/uncloud/helpers/assert-staging-db-isolated.ts` — parse postgres host; collect forbidden hosts; throw if staging URL host is forbidden
- `scripts/uncloud/helpers/assert-staging-db-isolated.test.ts` — unit tests

**Modify:**
- `scripts/uncloud/deploy-api.ts` — call assert after env load when target is staging
- `.env.staging.example` — separate-instance placeholders (no prod IP)
- `docs/staging.md` — lasting architecture wording (skills regenerate from docs)
- `docs/api-service.md` — stop saying “shared managed postgres” for migrations

Done: staging uses a dedicated managed Postgres instance; temporary provision steps were removed from this plan.

---

### Task 1: Staging DB isolation assert (TDD)

**Files:**
- Create: `scripts/uncloud/helpers/assert-staging-db-isolated.ts`
- Create: `scripts/uncloud/helpers/assert-staging-db-isolated.test.ts`

**Interfaces:**
- Produces:
  - `export const KNOWN_PRODUCTION_DB_HOSTS: readonly string[]` — includes `'34.13.41.244'`
  - `export function parsePostgresHost(url: string): string | null`
  - `export function readDeployDbHostFromEnvFile(path: string): string | null` — reads `DEPLOY_DB=` (or `DATABASE_URL=`) from a dotenv-style file without mutating `process.env`
  - `export function collectForbiddenProductionDbHosts(options?: { productionEnvPath?: string; knownHosts?: readonly string[] }): string[]`
  - `export function assertStagingDbIsolated(options: { stagingDbUrl: string; productionEnvPath?: string; knownHosts?: readonly string[] }): void` — throws if staging host is in the forbidden set

- [ ] **Step 1: Write the failing test**

Create `scripts/uncloud/helpers/assert-staging-db-isolated.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  assertStagingDbIsolated,
  collectForbiddenProductionDbHosts,
  parsePostgresHost,
  readDeployDbHostFromEnvFile,
} from './assert-staging-db-isolated'

describe('parsePostgresHost', () => {
  it('extracts host from a postgres url', () => {
    expect(
      parsePostgresHost(
        'postgresql://user:pass@34.13.41.244:5432/curatormtd?sslmode=require',
      ),
    ).toBe('34.13.41.244')
  })

  it('returns null for invalid input', () => {
    expect(parsePostgresHost('')).toBeNull()
    expect(parsePostgresHost('not-a-url')).toBeNull()
  })
})

describe('readDeployDbHostFromEnvFile', () => {
  it('reads DEPLOY_DB host from a dotenv file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mtd-staging-db-'))
    const path = join(dir, '.env.production')
    writeFileSync(
      path,
      'DEPLOY_DB=postgresql://u:p@prod-db.example:5432/postgres?sslmode=require\n',
    )
    expect(readDeployDbHostFromEnvFile(path)).toBe('prod-db.example')
  })

  it('returns null when file is missing', () => {
    expect(readDeployDbHostFromEnvFile('/tmp/does-not-exist-mtd.env')).toBeNull()
  })
})

describe('assertStagingDbIsolated', () => {
  afterEach(() => {
    // no process.env mutation in these tests
  })

  it('throws when staging host matches known production host', () => {
    expect(() =>
      assertStagingDbIsolated({
        stagingDbUrl:
          'postgresql://u:p@34.13.41.244:5432/curatormtd_staging?sslmode=require',
        productionEnvPath: '/tmp/does-not-exist-mtd.env',
      }),
    ).toThrow(/staging must not use the production postgres host/)
  })

  it('throws when staging host matches DEPLOY_DB host in .env.production', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mtd-staging-db-'))
    const path = join(dir, '.env.production')
    writeFileSync(
      path,
      'DEPLOY_DB=postgresql://u:p@prod-only.example:5432/postgres?sslmode=require\n',
    )
    expect(() =>
      assertStagingDbIsolated({
        stagingDbUrl:
          'postgresql://u:p@prod-only.example:5432/curatormtd?sslmode=require',
        productionEnvPath: path,
        knownHosts: [],
      }),
    ).toThrow(/staging must not use the production postgres host/)
  })

  it('passes when staging host is distinct', () => {
    expect(() =>
      assertStagingDbIsolated({
        stagingDbUrl:
          'postgresql://u:p@staging-db.example:5432/curatormtd?sslmode=require',
        productionEnvPath: '/tmp/does-not-exist-mtd.env',
      }),
    ).not.toThrow()
  })

  it('collectForbiddenProductionDbHosts includes known fallback', () => {
    const hosts = collectForbiddenProductionDbHosts({
      productionEnvPath: '/tmp/does-not-exist-mtd.env',
    })
    expect(hosts).toContain('34.13.41.244')
  })
})
```

- [ ] **Step 2: Run test — expect fail (module missing)**

Run: `bun test:unit scripts/uncloud/helpers/assert-staging-db-isolated.test.ts`

Expected: FAIL (cannot resolve module / export)

- [ ] **Step 3: Implement helper**

Create `scripts/uncloud/helpers/assert-staging-db-isolated.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs'

/** committed fallback if .env.production is absent (ci / fresh checkout) */
export const KNOWN_PRODUCTION_DB_HOSTS = ['34.13.41.244'] as const

export function parsePostgresHost(url: string): string | null {
  if (!url) return null
  try {
    const normalized = url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:')
    const host = new URL(normalized).hostname
    return host || null
  } catch {
    const match = url.match(/@([^:/?]+)/)
    return match?.[1] || null
  }
}

export function readDeployDbHostFromEnvFile(path: string): string | null {
  if (!existsSync(path)) return null
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*(DEPLOY_DB|DATABASE_URL)\s*=\s*(.+?)\s*$/.exec(line)
    if (!match) continue
    let value = match[2]!
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    const host = parsePostgresHost(value)
    if (host) return host
  }
  return null
}

export function collectForbiddenProductionDbHosts(options?: {
  productionEnvPath?: string
  knownHosts?: readonly string[]
}): string[] {
  const productionEnvPath = options?.productionEnvPath ?? '.env.production'
  const knownHosts = options?.knownHosts ?? KNOWN_PRODUCTION_DB_HOSTS
  const hosts = new Set<string>(knownHosts)
  const fromFile = readDeployDbHostFromEnvFile(productionEnvPath)
  if (fromFile) hosts.add(fromFile)
  return [...hosts]
}

export function assertStagingDbIsolated(options: {
  stagingDbUrl: string
  productionEnvPath?: string
  knownHosts?: readonly string[]
}): void {
  const stagingHost = parsePostgresHost(options.stagingDbUrl)
  if (!stagingHost) {
    throw new Error(
      'staging DEPLOY_DB/DATABASE_URL is missing or has no host\n' +
        'set DEPLOY_DB in .env.staging to a dedicated managed postgres instance',
    )
  }

  const forbidden = collectForbiddenProductionDbHosts({
    productionEnvPath: options.productionEnvPath,
    knownHosts: options.knownHosts,
  })

  if (forbidden.includes(stagingHost)) {
    throw new Error(
      `staging must not use the production postgres host (${stagingHost})\n` +
        'point DEPLOY_DB / DATABASE_URL in .env.staging at a separate managed instance',
    )
  }
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `bun test:unit scripts/uncloud/helpers/assert-staging-db-isolated.test.ts`

Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add scripts/uncloud/helpers/assert-staging-db-isolated.ts scripts/uncloud/helpers/assert-staging-db-isolated.test.ts
git commit -m "feat: assert staging db host is not production"
```

---

### Task 2: Wire guard into staging api deploy

**Files:**
- Modify: `scripts/uncloud/deploy-api.ts`

**Interfaces:**
- Consumes: `assertStagingDbIsolated` from Task 1; `parseUncloudEnvTarget` / `loadUncloudDeployEnv` / `assertDeployEnv` already in file
- Produces: staging deploys abort before `runUncloudDeploy` when DB host is production

- [ ] **Step 1: Update deploy-api.ts**

Replace `scripts/uncloud/deploy-api.ts` with:

```ts
#!/usr/bin/env bun

import { assertDeployEnv } from './helpers/assert-deploy-env'
import { assertStagingDbIsolated } from './helpers/assert-staging-db-isolated'
import { runUncloudDeploy } from './helpers/deploy-core'
import { loadUncloudDeployEnv, parseUncloudEnvTarget } from './helpers/load-deploy-env'

const target = parseUncloudEnvTarget()
await loadUncloudDeployEnv(target)
assertDeployEnv('api')

if (target === 'staging') {
  const stagingDbUrl = process.env.DEPLOY_DB || process.env.DATABASE_URL || ''
  assertStagingDbIsolated({ stagingDbUrl })
}

// default backend ship: api + worker (web is deploy-web)
await runUncloudDeploy({ name: target, services: ['api', 'worker'] })
```

- [ ] **Step 2: Smoke-check the guard without deploying**

With current `.env.staging` still on the shared prod host (if applicable):

Run: `bun tko uncloud deploy-api --staging --skip-build 2>&1 | head -40`

Expected: process throws / exits non-zero with message containing `staging must not use the production postgres host` **before** a full deploy progresses. If `.env.staging` already points at a distinct host, expected: guard passes and deploy proceeds (or fails later for unrelated reasons) — that is fine.

Alternative dry check without network/deploy:

```bash
bun -e "
import { loadUncloudDeployEnv, parseUncloudEnvTarget } from './scripts/uncloud/helpers/load-deploy-env.ts'
import { assertStagingDbIsolated } from './scripts/uncloud/helpers/assert-staging-db-isolated.ts'
await loadUncloudDeployEnv('staging')
const url = process.env.DEPLOY_DB || process.env.DATABASE_URL || ''
try {
  assertStagingDbIsolated({ stagingDbUrl: url })
  console.info('guard ok', url.replace(/:[^:@/]+@/, ':***@'))
} catch (e) {
  console.info(String(e))
  process.exitCode = 1
}
"
```

Expected when staging points at the production postgres host: error. Expected when staging uses a separate host: `guard ok`.

- [ ] **Step 3: Commit**

```bash
git add scripts/uncloud/deploy-api.ts
git commit -m "feat: block staging deploy on production postgres host"
```

---

### Task 3: Lasting docs and staging example

**Files:**
- Modify: `.env.staging.example`
- Modify: `docs/staging.md`
- Modify: `docs/api-service.md`

- [ ] **Step 1: Update `.env.staging.example` database section**

Replace the database comment + URLs with:

```env
# ---- database (separate managed postgres instance — not the production host) ----
DEPLOY_DB=postgresql://USER:PASSWORD@STAGING_DB_HOST:5432/curatormtd?sslmode=require
DATABASE_URL=postgresql://USER:PASSWORD@STAGING_DB_HOST:5432/curatormtd?sslmode=require
```

- [ ] **Step 2: Update `docs/staging.md` lasting wording**

In the intro paragraph, replace the shared-server sentence with:

```markdown
Staging is not a separate build mode. It runs in production mode with staging values on isolated infrastructure: its own VM, its own uncloud context (`staging`), and its own managed Postgres instance (different host from production).
```

In the config paragraph, change the DB clause so `DEPLOY_DB` / `DATABASE_URL` are described as pointing at that staging Postgres instance (not `curatormtd_staging` on a shared server).

In the deploy paragraph, say migrations run against the staging Postgres instance (not `curatormtd_staging` by name on the shared host).

In the verify section, replace the isolation check with:

```markdown
Confirm isolation by checking that data created via the preview app appears only in the staging Postgres instance, never in production.
```

- [ ] **Step 3: Update `docs/api-service.md`**

Replace:

```markdown
Database migrations run once per deploy against the shared managed postgres before the services roll.
```

with:

```markdown
Database migrations run once per deploy against that environment’s managed Postgres (`DEPLOY_DB`) before the services roll. Staging and production use separate Postgres instances.
```

- [ ] **Step 4: Regenerate skills if your checkout uses postinstall sync**

Run: `bun postinstall` (or whatever this repo uses to sync `docs/*.md` → `.claude/skills/`) only if skills are stale; source of truth is `docs/staging.md`.

- [ ] **Step 5: Commit**

```bash
git add .env.staging.example docs/staging.md docs/api-service.md
git commit -m "docs: staging uses a separate postgres instance"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Deploy isolation guard + unit tests | Tasks 1–2 |
| Lasting docs + `.env.staging.example` | Task 3 |
