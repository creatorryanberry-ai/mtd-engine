# Remove `/api/v1` Path Prefix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-cutover all `/api/v1/*` routes to unversioned `/api/*`, merge colliding methods cleanly, scrub residual `v1` naming, and leave no unused leftover files.

**Architecture:** Physically move `app/api/v1/**` route files under `app/api/**` so disk matches URLs. Fold `GET` transactions into the existing transactions route file; move enqueue quarterly to `/api/submissions/quarterly/jobs`. Update clients, OpenAPI registry, Scalar docs UI, and committed snapshot (`openapi.json`). Versioning stays numeric `apiContract` via `GET /api/handshake` — do not bump for this path-only change.

**Tech Stack:** One `+api.ts` routes, Bun route manifest, `defineRoute` / `registerRoute`, OpenAPI generator, Scalar (`api-docs/`), vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-31-remove-api-v1-path-prefix-design.md`
- Hard cutover: no redirects or dual `/api/v1` aliases
- Do not bump `API_CONTRACT_VERSION`
- Keep unused-but-intended endpoints (handshake, `GET /api/transactions`, enqueue jobs) on new paths
- Delete orphaned `v1` files/dirs after moves; rename snapshot to `src/api/openapi.json`
- Prefer `console.info()`; few lowercase comments; Conventional Commits lowercase one-line, no co-author
- Lasting docs: keep `docs/*.md` and matching `.claude/skills/*/SKILL.md` identical when both exist
- After code changes: `bun check` (or at least targeted unit tests while iterating)

---

## File Structure

**Move (git mv):**

| From | To |
|------|-----|
| `src/api/v1/handshake.ts` | `src/api/handshake.ts` |
| `app/api/v1/handshake+api.ts` | `app/api/handshake+api.ts` |
| `app/api/v1/events+api.ts` | `app/api/events+api.ts` |
| `app/api/v1/devices+api.ts` | `app/api/devices+api.ts` |
| `app/api/v1/notifications+api.ts` | `app/api/notifications+api.ts` |
| `app/api/v1/notifications/[id]+api.ts` | `app/api/notifications/[id]+api.ts` |
| `app/api/v1/users/me+api.ts` | `app/api/users/me+api.ts` |
| `app/api/v1/users/username-available+api.ts` | `app/api/users/username-available+api.ts` |
| `app/api/v1/users/business-settings+api.ts` | `app/api/users/business-settings+api.ts` |
| `app/api/v1/submissions/quarterly+api.ts` | `app/api/submissions/quarterly/jobs+api.ts` |
| `src/api/openapi/v1.ts` | `src/api/openapi/core.ts` |
| `src/api/openapi-v1.json` | `src/api/openapi.json` (after regen; may `git mv` then overwrite) |

**Modify in place:**

- `app/api/transactions+api.ts` — add `GET` from v1 file; keep `PATCH`
- All moved `+api.ts` / `handshake.ts` — `path: '/api/...'` (drop `/v1`)
- `src/api/openapi/core.ts`, `events.ts`, `info.ts`, `buildSpec.ts`, `load.ts`
- `scripts/docs/gen-openapi.ts` — write `src/api/openapi.json`
- Client call sites listed in Task 4
- `api-docs/main.ts` — single `/api` tree; drop v1/legacy kinds
- `docs/staging.md`, `docs/api-service.md`, `.claude/skills/staging/SKILL.md`, `.claude/skills/api-service/SKILL.md`
- Unit/integration tests with hardcoded `/api/v1`
- `src/contract/version.ts` — remove `API_VERSION_PREFIX`
- `src/server/routeManifest.generated.ts` — regenerate via `bun run api:manifest`

**Delete:**

- `app/api/v1/transactions+api.ts` (after merge)
- Empty `app/api/v1/**` and `src/api/v1/**` directories
- Any leftover `openapi-v1.json` / `openapi/v1.ts` after rename

---

### Task 1: Point unit tests at unversioned paths

**Files:**
- Modify: `src/test/unit/apiRouter.test.ts`
- Modify: `src/test/unit/openapiBuildSpec.test.ts`

**Interfaces:**
- Consumes: none (fixture paths only)
- Produces: tests that expect `/api/notifications`, `/api/users/me`, `/api/events`, `/api/submissions/quarterly/jobs`, and `info.version === '1'` (string of contract version with no `v1.` prefix)

- [ ] **Step 1: Update router fixtures**

In `src/test/unit/apiRouter.test.ts`, replace every `/api/v1/` with `/api/` (including `/api/v1/x/...` → `/api/x/...`). Keep behaviour assertions identical.

- [ ] **Step 2: Update openapi build-spec fixtures**

In `src/test/unit/openapiBuildSpec.test.ts`:

- Change fixture/lookup paths:
  - `/api/v1/users/me` → `/api/users/me`
  - `/api/v1/events` → `/api/events`
  - `/api/v1/submissions/quarterly` → `/api/submissions/quarterly/jobs`
- Add assertion in the first test (or a small new `it`) that `buildOpenapiSpec` sets `info.version` to `String(baseOpts.contractVersion)` (e.g. `'1'`), not `` `v1.${n}` ``. This will fail until Task 5 changes `buildSpec.ts`.

- [ ] **Step 3: Run tests (expect partial fail)**

Run:

```bash
bun test:unit src/test/unit/apiRouter.test.ts src/test/unit/openapiBuildSpec.test.ts
```

Expected: `apiRouter` still passes (fixtures only). `openapiBuildSpec` fails on live registry lookups (`quarterly/jobs`, events) and/or `info.version` until later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/test/unit/apiRouter.test.ts src/test/unit/openapiBuildSpec.test.ts
git commit -m "test: expect unversioned api paths in unit fixtures"
```

---

### Task 2: Move handshake, events, users, notifications, devices

**Files:**
- Move: `src/api/v1/handshake.ts` → `src/api/handshake.ts`
- Move: `app/api/v1/handshake+api.ts` → `app/api/handshake+api.ts`
- Move: `app/api/v1/events+api.ts` → `app/api/events+api.ts`
- Move: `app/api/v1/devices+api.ts` → `app/api/devices+api.ts`
- Move: `app/api/v1/notifications+api.ts` → `app/api/notifications+api.ts`
- Move: `app/api/v1/notifications/[id]+api.ts` → `app/api/notifications/[id]+api.ts`
- Move: `app/api/v1/users/**` → `app/api/users/**`
- Modify: each moved file’s `path` / import

**Interfaces:**
- Produces: live handlers at `/api/handshake`, `/api/events`, `/api/devices`, `/api/notifications`, `/api/notifications/:id`, `/api/users/me`, `/api/users/username-available`, `/api/users/business-settings`
- Consumes: `handshakeHandler` / `eventsHandler` from `~/api/handshake`

- [ ] **Step 1: git mv shared module and route files**

```bash
mkdir -p app/api/users app/api/notifications
git mv src/api/v1/handshake.ts src/api/handshake.ts
git mv app/api/v1/handshake+api.ts app/api/handshake+api.ts
git mv app/api/v1/events+api.ts app/api/events+api.ts
git mv app/api/v1/devices+api.ts app/api/devices+api.ts
git mv app/api/v1/notifications+api.ts app/api/notifications+api.ts
git mv app/api/v1/notifications/\[id\]+api.ts app/api/notifications/\[id\]+api.ts
git mv app/api/v1/users/me+api.ts app/api/users/me+api.ts
git mv app/api/v1/users/username-available+api.ts app/api/users/username-available+api.ts
git mv app/api/v1/users/business-settings+api.ts app/api/users/business-settings+api.ts
rmdir app/api/v1/notifications app/api/v1/users 2>/dev/null || true
```

- [ ] **Step 2: Fix imports and paths**

1. In `src/api/handshake.ts`, set `path: '/api/handshake'`.
2. In `app/api/handshake+api.ts` and `app/api/events+api.ts`, import from `~/api/handshake` (not `~/api/v1/handshake`).
3. In each moved `defineRoute` file, replace `path: '/api/v1/...'` with `path: '/api/...'` (notifications id keeps `{id}` OpenAPI form if already used).

- [ ] **Step 3: Regenerate manifest**

```bash
bun run api:manifest
```

Expected: `routeManifest.generated.ts` imports `app/api/handshake+api` etc.; no `app/api/v1/` entries for moved routes. (`transactions` / quarterly may still be under v1 until Task 3.)

- [ ] **Step 4: Commit**

```bash
git add -A app/api src/api/handshake.ts src/server/routeManifest.generated.ts
git commit -m "refactor: move core api routes off /api/v1"
```

---

### Task 3: Merge transactions GET; relocate quarterly jobs

**Files:**
- Modify: `app/api/transactions+api.ts`
- Delete: `app/api/v1/transactions+api.ts`
- Move: `app/api/v1/submissions/quarterly+api.ts` → `app/api/submissions/quarterly/jobs+api.ts`
- Delete: empty `app/api/v1/**`

**Interfaces:**
- Produces: `GET` + `PATCH` on `/api/transactions`; `POST /api/submissions/quarterly/jobs`
- Keeps: existing sync `POST`/`DELETE` on `app/api/submissions/quarterly+api.ts`

- [ ] **Step 1: Add GET to `app/api/transactions+api.ts`**

Keep the existing `PATCH` export. Add the v1 list handler as `GET` with path `/api/transactions` (copy from current v1 file, only change the path):

```ts
import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { listResponseSchema, mtdTransactionSchema } from '~/contract'
import { listMtdTransactions } from '~/features/api/server/transactions'
// ... existing PATCH imports ...

const querySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.transform(Number))),
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/transactions',
  summary: 'List MTD transactions for the current user',
  tags: ['transactions'],
  input: querySchema,
  output: listResponseSchema(mtdTransactionSchema),
  handler: async (input, { request }) => {
    const auth = await requireApiAuth(request)
    const items = await listMtdTransactions({
      userId: auth.id,
      limit: input.limit != null ? Number(input.limit) : undefined,
    })
    return { items }
  },
})

export const PATCH: Endpoint = async (request) => {
  // unchanged
}
```

Then:

```bash
git rm app/api/v1/transactions+api.ts
```

- [ ] **Step 2: Move enqueue quarterly to jobs**

```bash
mkdir -p app/api/submissions/quarterly
git mv app/api/v1/submissions/quarterly+api.ts app/api/submissions/quarterly/jobs+api.ts
```

In `jobs+api.ts`, set:

```ts
path: '/api/submissions/quarterly/jobs',
```

Remove empty `app/api/v1` tree:

```bash
rm -rf app/api/v1
```

Confirm `app/api/submissions/quarterly+api.ts` (sync) is untouched.

- [ ] **Step 3: Regenerate manifest**

```bash
bun run api:manifest
rg '/api/v1' src/server/routeManifest.generated.ts || true
```

Expected: no `/api/v1` in the manifest. Patterns include `GET /api/transactions`, `PATCH /api/transactions`, `POST /api/submissions/quarterly/jobs`.

- [ ] **Step 4: Commit**

```bash
git add -A app/api src/server/routeManifest.generated.ts
git commit -m "refactor: merge transactions get and move quarterly jobs path"
```

---

### Task 4: Update app clients and integration helper

**Files:**
- Modify: `src/features/user/useUser.ts`
- Modify: `src/features/user/useProfileEdit.ts`
- Modify: `src/features/business/useBusinessSettings.ts`
- Modify: `src/features/notification/useNotifications.ts`
- Modify: `src/interface/notification/NotificationList.tsx`
- Modify: `src/features/notification/registerDevice.native.ts`
- Modify: `src/features/api/client/ProvideQuery.tsx`
- Modify: `src/test/integration/helpers.ts`

**Interfaces:**
- Consumes: new unversioned paths from Tasks 2–3
- Produces: no client still calling `/api/v1/*`

- [ ] **Step 1: Replace path strings**

| File | Old | New |
|------|-----|-----|
| `useUser.ts` | `/api/v1/users/me` | `/api/users/me` |
| `useProfileEdit.ts` | `/api/v1/users/username-available?...` | `/api/users/username-available?...` |
| `useBusinessSettings.ts` | `/api/v1/users/business-settings` | `/api/users/business-settings` |
| `useNotifications.ts` | `/api/v1/notifications...` | `/api/notifications...` |
| `NotificationList.tsx` | `/api/v1/notifications/${id}` | `/api/notifications/${id}` |
| `registerDevice.native.ts` | `/api/v1/devices` | `/api/devices` |
| `ProvideQuery.tsx` | `/api/v1/events` | `/api/events` |
| `helpers.ts` | `/api/v1/users/business-settings` | `/api/users/business-settings` |

- [ ] **Step 2: Grep for stragglers in src/**

```bash
rg '/api/v1' src --glob '*.{ts,tsx}'
```

Expected: no matches in app/feature/test code (generated OpenAPI snapshot may still mention v1 until Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/features src/interface/notification/NotificationList.tsx src/test/integration/helpers.ts
git commit -m "fix: point clients at unversioned api paths"
```

---

### Task 5: OpenAPI registry, snapshot rename, version string

**Files:**
- Move: `src/api/openapi/v1.ts` → `src/api/openapi/core.ts`
- Modify: `src/api/openapi/load.ts` — `import './core'` instead of `./v1`
- Modify: `src/api/openapi/core.ts` — all paths drop `/v1`; enqueue → `/api/submissions/quarterly/jobs`
- Modify: `src/api/openapi/events.ts` — `path: '/api/events'`
- Modify: `src/api/openapi/buildSpec.ts` — `version: String(options.contractVersion)` (or `` `${options.contractVersion}` ``)
- Modify: `src/api/openapi/info.ts` — description + tag blurbs without v1/legacy framing
- Modify: `scripts/docs/gen-openapi.ts` — output `src/api/openapi.json`
- Regenerate: `src/api/openapi.json`; remove `src/api/openapi-v1.json`
- Modify: `src/contract/version.ts` — delete `API_VERSION_PREFIX`

**Interfaces:**
- Produces: OpenAPI snapshot at `src/api/openapi.json` with unversioned paths; `info.version` = `"1"` when contract is `1`

- [ ] **Step 1: Rename module and update paths**

```bash
git mv src/api/openapi/v1.ts src/api/openapi/core.ts
```

In `load.ts`:

```ts
import './core'
```

In `core.ts` / `events.ts`, update every `path` per the spec table (including jobs).

- [ ] **Step 2: buildSpec + info + drop prefix**

`buildSpec.ts`:

```ts
version: `${options.contractVersion}`,
```

`info.ts` — replace versioning / surface prose with:

```ts
export const OPENAPI_INFO_DESCRIPTION = `
HTTP API for the Curator MTD app. This document covers the **full api-service surface** served by the standalone API process (see route manifest).

**Versioning**

- Paths are unversioned under \`/api/*\`. Clients send \`x-app-version\` (or \`appVersion\` query) to \`GET /api/handshake\`, which returns numeric \`apiContract\` and \`status\` (\`ok\` | \`deprecated\` | \`blocked\`).
- Incompatible request/response shape changes bump \`apiContract\`; URL prefixes like \`/api/v2\` are reserved for a future deliberate cutover.

**Authentication** (mirrors the app)
// ... keep existing OTP / Bearer / cookie sections unchanged ...
`
```

Also update tag descriptions that say “v1 list + legacy …” / “v1 job enqueue + legacy …” to neutral wording (e.g. “list and mutate MTD transactions”, “quarterly HMRC submit, job enqueue, and summaries”).

In `src/contract/version.ts`, delete:

```ts
export const API_VERSION_PREFIX = 'v1' as const
```

Confirm nothing imports it: `rg 'API_VERSION_PREFIX' --glob '*.{ts,tsx}'`.

- [ ] **Step 3: Point generator + regenerate snapshot**

In `scripts/docs/gen-openapi.ts`:

```ts
const outPath = resolve(import.meta.dir, '../../src/api/openapi.json')
```

```bash
git mv src/api/openapi-v1.json src/api/openapi.json
bun run docs:openapi
rg '/api/v1' src/api/openapi.json || true
```

Expected: snapshot has `/api/handshake`, `/api/users/me`, `/api/submissions/quarterly/jobs`; no `/api/v1`; `info.version` is `"1"`.

- [ ] **Step 4: Run unit tests**

```bash
bun test:unit src/test/unit/openapiBuildSpec.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/api/openapi src/api/openapi.json src/contract/version.ts scripts/docs/gen-openapi.ts
git rm -f src/api/openapi-v1.json 2>/dev/null || true
git commit -m "docs: unversioned openapi paths and rename snapshot"
```

---

### Task 6: Simplify Scalar docs UI

**Files:**
- Modify: `api-docs/main.ts`

**Interfaces:**
- Consumes: `../src/api/openapi.json`
- Produces: single `/api` navigation tree (no `v1`/`legacy` kinds or rename pass)

- [ ] **Step 1: Switch import**

```ts
import rawSpec from '../src/api/openapi.json'
```

- [ ] **Step 2: Drop v1/legacy split**

Simplify `relativeToTag` to only strip `/api/${tag}` (and fallback `/api/` → other). Remove `kind`, `renameV1Legacy`, and the “disambiguate v1 vs legacy” loop. Keep:

- slash labels (`withSlash`)
- sidebar method titles (`rewriteSidebarTitles`)
- method badges / full-path headings
- domain folders from tags

Example relative helper:

```ts
function relativeToTag(fullPath: string, tag: string) {
  const prefix = `/api/${tag}`
  if (fullPath === prefix || fullPath.startsWith(`${prefix}/`)) {
    return { label: displayLabel(fullPath.slice(prefix.length) || '/') }
  }
  if (fullPath.startsWith('/api/')) {
    return { label: displayLabel(fullPath.slice('/api'.length)) }
  }
  return { label: displayLabel(fullPath) }
}
```

Update `Pending` type to drop `kind`.

- [ ] **Step 3: Smoke-build docs**

```bash
bun run api-docs:build
```

Expected: Vite build succeeds.

- [ ] **Step 4: Commit**

```bash
git add api-docs/main.ts
git commit -m "refactor: simplify scalar nav to single api tree"
```

---

### Task 7: Update lasting docs and skills

**Files:**
- Modify: `docs/staging.md`
- Modify: `docs/api-service.md`
- Modify: `.claude/skills/staging/SKILL.md` (keep identical to staging.md if that is the project rule for this pair)
- Modify: `.claude/skills/api-service/SKILL.md` (same)

**Interfaces:**
- Produces: curl examples use `GET /api/handshake`; no `/api/v1` in these live docs

- [ ] **Step 1: Replace handshake curls**

In `docs/staging.md` and `docs/api-service.md` (and matching skills):

```bash
curl -fsS https://staging-api.curatormtd.co.uk/api/handshake -H "x-app-version: 0.0.0"
curl -fsS https://api.curatormtd.co.uk/api/handshake -H "x-app-version: 0.0.0"
```

Adjust any prose that calls handshake `/api/v1/handshake` or describes `/api/v1/*` as the versioned contract — point at `apiContract` + `/api/handshake` instead.

If skill files are copies of the docs, update both so they stay identical.

- [ ] **Step 2: Grep docs for remaining live references**

```bash
rg '/api/v1' docs/staging.md docs/api-service.md .claude/skills/staging .claude/skills/api-service || true
```

Expected: no matches in those living docs. (Historical plans/specs under `docs/superpowers/` may still mention `/api/v1` — leave them.)

- [ ] **Step 3: Commit**

```bash
git add docs/staging.md docs/api-service.md .claude/skills/staging .claude/skills/api-service
git commit -m "docs: point handshake curls at /api/handshake"
```

---

### Task 8: Final verification

**Files:**
- Touch only if grep finds stragglers outside historical `docs/superpowers/`

- [ ] **Step 1: Repo-wide grep (code + living docs)**

```bash
rg '/api/v1' app src api-docs scripts docs/staging.md docs/api-service.md .claude/skills --glob '!**/openapi.json'
rg 'openapi-v1|API_VERSION_PREFIX|api/openapi/v1' app src api-docs scripts --glob '*.{ts,tsx,json,md}'
test ! -e src/api/openapi-v1.json
test ! -d app/api/v1
test ! -d src/api/v1
```

Expected: no live code references; snapshot file is `src/api/openapi.json` only.

- [ ] **Step 2: Full check**

```bash
bun check
```

Expected: pass (types, lint, unit, manifest freshness, etc. per project `tko check`).

- [ ] **Step 3: Commit any leftover fixes** (only if Step 1–2 required edits)

```bash
git add -A
git commit -m "chore: finish api v1 path removal cleanup"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Drop `/v1` from all live URLs | 2, 3 |
| Hard cutover, no redirects | Global + all tasks |
| Merge GET onto `/api/transactions` | 3 |
| Enqueue → `/api/submissions/quarterly/jobs` | 3 |
| Move route files to match disk | 2, 3 |
| Keep unused endpoints | 2, 3 |
| Update clients + integration helper | 4 |
| Rename OpenAPI module + snapshot | 5 |
| Drop `API_VERSION_PREFIX`; `info.version` without `v1.` | 5 |
| Rewrite OpenAPI intro / tags | 5 |
| Simplify Scalar (no v1/legacy) | 6 |
| Update staging/api-service docs | 7 |
| Unit test path updates | 1 |
| Regen manifest + openapi; `bun check` | 3, 5, 8 |
| No leftover unused v1 files | 2, 3, 5, 8 |
| Do not bump `apiContract` | Global |
| Out of scope: defineRoute rewrite of all ad-hoc routes | — |

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-31-remove-api-v1-path-prefix.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
