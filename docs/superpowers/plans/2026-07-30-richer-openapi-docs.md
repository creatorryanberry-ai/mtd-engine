# Richer OpenAPI / Scalar Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the generated OpenAPI snapshot (and Scalar `/docs`) a complete, explanatory map of the api-service surface — including real auth — so internal engineers can test with any HTTP client.

**Architecture:** Keep `registerRoute` / `defineRoute` as the registry. Extend route metadata and move generation into a pure `buildOpenapiSpec` helper. Load v1 routes via their `defineRoute` modules (stop duplicating them in a separate manifest) and register legacy/auth/health routes in domain files under `src/api/openapi/`. Add a manifest↔OpenAPI coverage check so gaps cannot silently return.

**Tech Stack:** Bun, Valibot, `@valibot/to-json-schema`, OpenAPI 3.1, vitest, existing Scalar `api-docs/` build.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-richer-openapi-docs-design.md`
- Audience: internal engineers; Postman is a use case, not a deliverable
- Mirror real auth: cookie `better-auth.session_token` and `Authorization: Bearer <session token>`
- Document the full api-service surface from `src/server/routeManifest.generated.ts`; exclude `/api/og`
- Better Auth: document tester-critical ops only; allowlist the catch-all in coverage
- File routes: document **POST only** (handlers return 405 for other methods even if the manifest lists them); allowlist phantom methods in coverage
- Prefer `console.info()`; few lowercase comments; Conventional Commits lowercase one-line, no co-author
- After meaningful code changes: `bun check` (or targeted vitest + `bun run docs:openapi`)
- Do not hard-wrap prose in markdown docs

---

## File Structure

**Create:**
- `src/api/openapi/buildSpec.ts` — pure OpenAPI document builder from `apiRoutes` + static info/tags/servers/security
- `src/api/openapi/info.ts` — `INFO_DESCRIPTION` markdown + `SERVERS` + `TAG_DESCRIPTIONS`
- `src/api/openapi/load.ts` — side-effect imports that populate `apiRoutes`
- `src/api/openapi/auth.ts` — Better Auth ops + validateToken
- `src/api/openapi/health.ts`
- `src/api/openapi/events.ts` — SSE events route (not using defineRoute today)
- `src/api/openapi/plaid.ts`
- `src/api/openapi/hmrc.ts`
- `src/api/openapi/transactions.ts` — legacy `/api/transactions*`
- `src/api/openapi/submissions.ts` — legacy submissions
- `src/api/openapi/mileage.ts`
- `src/api/openapi/categorisation.ts`
- `src/api/openapi/file.ts`
- `src/api/openapi/stats.ts`
- `src/api/openapi/schemas/mtdTransactionDto.ts` — Valibot for legacy `MtdTransactionDto`
- `src/api/openapi/schemas/error.ts` — shared `{ error: string }` (or reuse `~/contract` `errorResponseSchema`)
- `src/api/openapi/coverage.ts` — pure `diffManifestCoverage(manifest, openapiPaths)`
- `src/test/unit/openapiBuildSpec.test.ts`
- `src/test/unit/openapiCoverage.test.ts`
- `scripts/check/openapi-coverage.ts` — fails CI if manifest ops lack OpenAPI (minus allowlist)

**Modify:**
- `src/api/registry.ts` — extend `RouteSpec`
- `src/api/defineRoute.ts` — pass through new `RouteSpec` fields
- `scripts/docs/gen-openapi.ts` — load via `~/api/openapi/load`, call `buildOpenapiSpec`, write JSON
- All existing `defineRoute(...)` call sites under `app/api/v1/**` and `src/api/v1/handshake.ts` — add `description`, `public` / default security, examples where useful
- `app/api/v1/users/business-settings+api.ts` — already `defineRoute`; ensure loaded by `load.ts` and enriched
- Delete or gut `src/api/openapiManifest.ts` once `load.ts` replaces it (no duplicate registrations)
- `docs/staging.md` + `.claude/skills/staging/SKILL.md` — short note that `/docs` documents the full api surface + how to Bearer-auth Try it
- `docs/api-service.md` + `.claude/skills/api-service/SKILL.md` — same, briefly

**Do not modify for phantom methods:** leave route manifest generation as-is; coverage allowlist handles file GET/PATCH/PUT/DELETE.

---

### Task 1: Extend RouteSpec + pure `buildOpenapiSpec` (TDD)

**Files:**
- Modify: `src/api/registry.ts`
- Modify: `src/api/defineRoute.ts`
- Create: `src/api/openapi/buildSpec.ts`
- Create: `src/test/unit/openapiBuildSpec.test.ts`

**Interfaces:**
- Extends `RouteSpec`:
  ```ts
  export type RouteSecurity = 'bearer' | 'cookie' | 'public'

  export type RouteSpec = {
    method: HttpMethod
    path: string
    summary: string
    description?: string
    tags?: string[]
    /** default: authenticated via bearer OR cookie. use 'public' for open routes */
    security?: RouteSecurity
    input?: BaseSchema<unknown, unknown, BaseIssue<unknown>>
    output?: BaseSchema<unknown, unknown, BaseIssue<unknown>>
    /** when set, used instead of JSON input schema (e.g. multipart) */
    requestContentType?: string
    examples?: { request?: unknown; response?: unknown }
    errorResponses?: Array<{
      status: number
      description: string
      schema?: BaseSchema<unknown, unknown, BaseIssue<unknown>>
    }>
    /** override success response content-type (default application/json). use for SSE */
    successContentType?: string
  }
  ```
- `output` becomes optional only for rare non-JSON successes; JSON routes still require it.
- Produces: `export function buildOpenapiSpec(routes: RouteSpec[], options: { contractVersion: number; infoDescription: string; servers: Array<{ url: string; description: string }>; tags: Array<{ name: string; description: string }> }): Record<string, unknown>`
- Security schemes always emitted:
  - `bearerAuth`: `http` / `bearer`
  - `cookieAuth`: `apiKey` / `in: cookie` / `name: better-auth.session_token`
- If `security === 'public'` (or omitted only when explicitly `'public'`): operation `security: []`
- Else: `security: [{ bearerAuth: [] }, { cookieAuth: [] }]` (OR — either works)
- Default for routes that omit `security`: treat as authenticated (bearer|cookie), except we will set `public` explicitly on public routes in later tasks

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/openapiBuildSpec.test.ts`:

```ts
import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

import { buildOpenapiSpec } from '~/api/openapi/buildSpec'

import type { RouteSpec } from '~/api/registry'

const baseOpts = {
  contractVersion: 1,
  infoDescription: 'Test API',
  servers: [{ url: 'http://localhost:8082', description: 'Local' }],
  tags: [{ name: 'meta', description: 'Meta' }],
}

describe('buildOpenapiSpec', () => {
  it('emits servers, securitySchemes, and public vs authed security', () => {
    const routes: RouteSpec[] = [
      {
        method: 'GET',
        path: '/api/health',
        summary: 'Health',
        tags: ['meta'],
        security: 'public',
        output: v.object({ status: v.string() }),
      },
      {
        method: 'GET',
        path: '/api/v1/users/me',
        summary: 'Me',
        description: 'Current user',
        tags: ['users'],
        security: 'bearer',
        output: v.object({ id: v.string() }),
        examples: { response: { id: 'u1' } },
        errorResponses: [
          {
            status: 401,
            description: 'Unauthorized',
            schema: v.object({ error: v.string() }),
          },
        ],
      },
    ]

    const spec = buildOpenapiSpec(routes, baseOpts) as any
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.description).toBe('Test API')
    expect(spec.servers).toEqual(baseOpts.servers)
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    })
    expect(spec.components.securitySchemes.cookieAuth).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'better-auth.session_token',
    })
    expect(spec.paths['/api/health'].get.security).toEqual([])
    expect(spec.paths['/api/v1/users/me'].get.security).toEqual([
      { bearerAuth: [] },
      { cookieAuth: [] },
    ])
    expect(spec.paths['/api/v1/users/me'].get.description).toBe('Current user')
    expect(spec.paths['/api/v1/users/me'].get.responses['401']).toBeTruthy()
    expect(
      spec.paths['/api/v1/users/me'].get.responses['200'].content['application/json']
        .example,
    ).toEqual({ id: 'u1' })
  })

  it('supports multipart request and sse success content types', () => {
    const routes: RouteSpec[] = [
      {
        method: 'POST',
        path: '/api/file/upload',
        summary: 'Upload',
        security: 'bearer',
        requestContentType: 'multipart/form-data',
        output: v.object({ url: v.string() }),
      },
      {
        method: 'GET',
        path: '/api/v1/events',
        summary: 'Events',
        security: 'bearer',
        successContentType: 'text/event-stream',
        output: v.object({ type: v.string() }),
      },
    ]
    const spec = buildOpenapiSpec(routes, baseOpts) as any
    expect(
      spec.paths['/api/file/upload'].post.requestBody.content['multipart/form-data'],
    ).toBeTruthy()
    expect(
      spec.paths['/api/v1/events'].get.responses['200'].content['text/event-stream'],
    ).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/openapiBuildSpec.test.ts`

Expected: FAIL — module `~/api/openapi/buildSpec` missing

- [ ] **Step 3: Extend registry + defineRoute + implement buildSpec**

Update `src/api/registry.ts` with the `RouteSpec` fields above (`output` optional for the type, but JSON routes always pass it).

Update `src/api/defineRoute.ts` to forward `security`, `examples`, `errorResponses`, `requestContentType`, `successContentType` into `registerRoute({...})`. Keep runtime behavior unchanged.

Create `src/api/openapi/buildSpec.ts` implementing the rules in Interfaces. Important details:

- Omit `description` from the operation when undefined/empty
- For GET/DELETE: query params from `input` via existing `queryParameters` logic (move helpers here from `gen-openapi.ts`)
- For other methods with `input` and no `requestContentType`: JSON requestBody
- For `requestContentType: 'multipart/form-data'`: requestBody with that content type; schema can be a minimal object `{ type: 'object', properties: { file: { type: 'string', format: 'binary' } } }` when `input` is absent
- Merge default `200` response with `errorResponses`
- Put `examples.response` on the 200 media object as `example`
- Put `examples.request` on the requestBody media object as `example` when present
- `info.version` = `` `v1.${options.contractVersion}` ``
- `info.title` = `Curator MTD API`

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/openapiBuildSpec.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/registry.ts src/api/defineRoute.ts src/api/openapi/buildSpec.ts src/test/unit/openapiBuildSpec.test.ts
git commit -m "feat: extend openapi route metadata and buildSpec helper"
```

---

### Task 2: Wire generator load path + info/servers/tags

**Files:**
- Create: `src/api/openapi/info.ts`
- Create: `src/api/openapi/load.ts`
- Modify: `scripts/docs/gen-openapi.ts`
- Delete after cutover: `src/api/openapiManifest.ts` (once load covers current v1 set)

**Interfaces:**
- `load.ts` side-effect imports (order irrelevant):
  - all v1 modules that call `defineRoute` / export handlers that register:
    - `~/api/v1/handshake` (registers handshake; events registered separately)
    - from `src/api/openapi/load.ts`, import `../../../app/api/v1/...+api` for: `transactions`, `users/me`, `users/username-available`, `users/business-settings`, `notifications`, `notifications/[id]`, `devices`, `submissions/quarterly`
  - domain stubs imported as they land in later tasks (`./auth`, `./health`, …)
- Until later tasks add domain files, `load.ts` may only import v1 modules — generator must still produce at least today’s v1 paths + business-settings once loaded
- `info.ts` exports:
  - `OPENAPI_SERVERS`
  - `OPENAPI_TAGS`
  - `OPENAPI_INFO_DESCRIPTION` (markdown string)

- [ ] **Step 1: Write `info.ts`**

```ts
export const OPENAPI_SERVERS = [
  {
    url: 'http://localhost:8082',
    description: 'Local (bun backend / api on VITE web port)',
  },
  {
    url: 'https://staging-api.curatormtd.co.uk',
    description: 'Staging api (Scalar /docs hosted here; Cloudflare Access gates /docs only)',
  },
  {
    url: 'https://api.curatormtd.co.uk',
    description: 'Production api (no public /docs)',
  },
]

export const OPENAPI_TAGS: Array<{ name: string; description: string }> = [
  { name: 'auth', description: 'Better Auth session lifecycle used by the app (email sign-in, session, sign-out).' },
  { name: 'meta', description: 'Health, handshake, and other non-domain meta endpoints.' },
  { name: 'health', description: 'Liveness / deploy identity.' },
  { name: 'users', description: 'Current user profile and business settings.' },
  { name: 'transactions', description: 'MTD transactions (v1 list + legacy mutate/approve/manual).' },
  { name: 'notifications', description: 'In-app notifications.' },
  { name: 'devices', description: 'Device registration and push tokens.' },
  { name: 'submissions', description: 'Quarterly HMRC submission flows (v1 job enqueue + legacy submit/summary).' },
  { name: 'events', description: 'Authenticated server-sent events for live updates.' },
  { name: 'plaid', description: 'Bank connection status, accounts, and imported transactions.' },
  { name: 'hmrc', description: 'HMRC Making Tax Digital connection and obligations.' },
  { name: 'mileage', description: 'Mileage expense entries.' },
  { name: 'categorisation', description: 'Merchant categorisation rules and review stats.' },
  { name: 'file', description: 'Authenticated file upload (receipts and generic objects).' },
  { name: 'stats', description: 'Anonymous product analytics proxy.' },
]

export const OPENAPI_INFO_DESCRIPTION = `
# Curator MTD API

HTTP API for the Curator MTD app. This document covers the **full api-service surface** served by the standalone API process (see route manifest), not only \`/api/v1\`.

## Versioning

- \`/api/v1/*\` is the versioned contract. Clients send \`x-app-version\` (or \`appVersion\` query) to \`GET /api/v1/handshake\`, which returns \`apiContract\` and \`status\` (\`ok\` | \`deprecated\` | \`blocked\`).
- Older \`/api/*\` paths are still live product endpoints. They are documented here so testers can exercise real app flows.

## Authentication (mirrors the app)

1. Sign in: \`POST /api/auth/sign-in/email\` with \`{ "email", "password" }\` (sign-up when public auth allows).
2. Call protected routes with either:
   - **Bearer (preferred for Try it / Postman / curl):** \`Authorization: Bearer <token>\` where \`token\` comes from the sign-in / session payload (native app path via Better Auth bearer plugin).
   - **Cookie (web):** session cookie \`better-auth.session_token\` when the client stores cookies.
3. Inspect session: \`GET /api/auth/get-session\`.
4. Sign out: \`POST /api/auth/sign-out\`.

Public auth / demo auth may be disabled in some environments (\`ALLOW_PUBLIC_AUTH\` / \`ALLOW_DEMO_AUTH\`). Staging \`/docs\` Cloudflare Access is **separate** from API session auth — Access only gates the docs UI.

## Trying calls

Pick a server above, authenticate, then call any authed operation. Prefer Bearer for non-browser clients.
`.trim()
```

- [ ] **Step 2: Write `load.ts` that imports all current defineRoute modules**

```ts
// side-effect: populate apiRoutes via defineRoute
import '~/api/v1/handshake'
import '../../../app/api/v1/transactions+api'
import '../../../app/api/v1/users/me+api'
import '../../../app/api/v1/users/username-available+api'
import '../../../app/api/v1/users/business-settings+api'
import '../../../app/api/v1/notifications+api'
import '../../../app/api/v1/notifications/[id]+api'
import '../../../app/api/v1/devices+api'
import '../../../app/api/v1/submissions/quarterly+api'

// domain registries (added in later tasks — import when files exist)
// import './auth'
// import './health'
// …
```

Use import paths that resolve under the repo’s tsconfig/`~` alias; prefer `~/…` and relative `app/api/…` forms that already work in scripts (match how `routeManifest.generated.ts` imports app routes). If importing `app/api/**+api.ts` pulls env that fails in the docs script, fix by ensuring `docs:openapi` runs with the same env loading other bun scripts use (`bun run` already loads project env). If a module is too heavy, register those routes in `src/api/openapi/v1.ts` with `registerRoute` only — but prefer single source via `defineRoute`.

- [ ] **Step 3: Rewrite `scripts/docs/gen-openapi.ts`**

```ts
#!/usr/bin/env bun
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildOpenapiSpec } from '~/api/openapi/buildSpec'
import {
  OPENAPI_INFO_DESCRIPTION,
  OPENAPI_SERVERS,
  OPENAPI_TAGS,
} from '~/api/openapi/info'
import '~/api/openapi/load'
import { apiRoutes } from '~/api/registry'
import { API_CONTRACT_VERSION } from '~/contract'

const outPath = resolve(import.meta.dir, '../../src/api/openapi-v1.json')

const spec = buildOpenapiSpec(apiRoutes, {
  contractVersion: API_CONTRACT_VERSION,
  infoDescription: OPENAPI_INFO_DESCRIPTION,
  servers: OPENAPI_SERVERS,
  tags: OPENAPI_TAGS,
})

writeFileSync(outPath, JSON.stringify(spec, null, 2))
console.info(`wrote ${outPath} (${apiRoutes.length} operations)`)
```

- [ ] **Step 4: Remove duplicate `openapiManifest.ts` registrations**

Delete `src/api/openapiManifest.ts` and any remaining imports of it. Ensure `load.ts` is the only registrar for v1.

- [ ] **Step 5: Mark public routes on defineRoute call sites that must stay public**

In `src/api/v1/handshake.ts`, add `security: 'public'` to `handshakeHandler`.

Leave other v1 routes defaulting to authenticated in `buildOpenapiSpec` when `security` is omitted — implement default as: `security == null || security === 'bearer' || security === 'cookie'` → bearer|cookie OR list; only `'public'` clears security.

- [ ] **Step 6: Regenerate and sanity-check**

Run: `bun run docs:openapi`

Expected: writes JSON; paths include previous v1 routes **and** `/api/v1/users/business-settings`; `info.description` is the long markdown; `servers` present.

- [ ] **Step 7: Commit**

```bash
git add src/api/openapi scripts/docs/gen-openapi.ts src/api/v1/handshake.ts src/api/openapi-v1.json
git add -u src/api/openapiManifest.ts
git commit -m "feat: load openapi from defineRoute modules with rich info"
```

---

### Task 3: Manifest ↔ OpenAPI coverage check (TDD)

**Files:**
- Create: `src/api/openapi/coverage.ts`
- Create: `src/test/unit/openapiCoverage.test.ts`
- Create: `scripts/check/openapi-coverage.ts`

**Interfaces:**
- `export type ManifestOp = { method: string; pattern: string }`
- `export function normalizeManifestPath(pattern: string): string` — `/api/plaid/accounts/:id` → `/api/plaid/accounts/{id}`; leave `*` as `*`
- `export function diffManifestCoverage(args: { manifest: ManifestOp[]; openapiPaths: Record<string, Record<string, unknown>>; allowlist: ManifestOp[] }): { missing: ManifestOp[] }`
- Allowlist entries are exact method+normalized path matches that are excused
- For `/api/auth/*` GET and POST: if OpenAPI contains the five documented auth ops (sign-in/email, sign-up/email, sign-out, get-session, validateToken), treat both catch-all manifest rows as covered; do not require an OpenAPI path literally named `/api/auth/*`

- [ ] **Step 1: Write failing unit tests**

```ts
import { describe, expect, it } from 'vitest'

import { diffManifestCoverage, normalizeManifestPath } from '~/api/openapi/coverage'

describe('openapi coverage', () => {
  it('normalizes :param to {param}', () => {
    expect(normalizeManifestPath('/api/plaid/accounts/:id')).toBe(
      '/api/plaid/accounts/{id}',
    )
  })

  it('reports missing ops not in openapi or allowlist', () => {
    const { missing } = diffManifestCoverage({
      manifest: [
        { method: 'GET', pattern: '/api/health' },
        { method: 'POST', pattern: '/api/stats' },
      ],
      openapiPaths: {
        '/api/health': { get: {} },
      },
      allowlist: [],
    })
    expect(missing).toEqual([{ method: 'POST', pattern: '/api/stats' }])
  })

  it('treats auth catch-all covered when documented auth ops exist', () => {
    const { missing } = diffManifestCoverage({
      manifest: [
        { method: 'GET', pattern: '/api/auth/*' },
        { method: 'POST', pattern: '/api/auth/*' },
      ],
      openapiPaths: {
        '/api/auth/sign-in/email': { post: {} },
        '/api/auth/sign-up/email': { post: {} },
        '/api/auth/sign-out': { post: {} },
        '/api/auth/get-session': { get: {} },
        '/api/auth/validateToken': { post: {} },
      },
      allowlist: [],
    })
    expect(missing).toEqual([])
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/openapiCoverage.test.ts`

- [ ] **Step 3: Implement `coverage.ts` + check script**

`scripts/check/openapi-coverage.ts`:

- Import `apiRouteManifest` from `~/server/routeManifest.generated`
- Run `bun run docs:openapi` logic in-process: import `~/api/openapi/load`, `buildOpenapiSpec`, read paths from the built spec (do not trust a stale committed file alone — rebuild in memory)
- Allowlist initially:
  - All `GET|PATCH|PUT|DELETE` for `/api/file/receipt` and `/api/file/upload` (phantom methods)
  - Until domain tasks land, **do not enable the check in CI yet** OR enable it with a temporary broad allowlist that shrinks each task — prefer: add the script but only wire it into `bun check` at the end of Task 9 when coverage is complete. For this task, land the pure helper + unit tests + script that can be run manually; Task 9 flips it on.

Document in the script header: run via `bun run ./scripts/check/openapi-coverage.ts`.

- [ ] **Step 4: Tests pass; commit**

```bash
git add src/api/openapi/coverage.ts src/test/unit/openapiCoverage.test.ts scripts/check/openapi-coverage.ts
git commit -m "test: add openapi manifest coverage helper"
```

---

### Task 4: Auth + health OpenAPI registrations

**Files:**
- Create: `src/api/openapi/auth.ts`
- Create: `src/api/openapi/health.ts`
- Modify: `src/api/openapi/load.ts` — import `./auth` and `./health`
- Regenerate: `src/api/openapi-v1.json`

**Interfaces / content:**

Health:

```ts
registerRoute({
  method: 'GET',
  path: '/api/health',
  summary: 'API liveness',
  description: 'Returns ok plus deploy sha and environment. Public; use for smoke tests.',
  tags: ['health'],
  security: 'public',
  output: v.object({
    status: v.literal('ok'),
    sha: v.string(),
    env: v.string(),
    timestamp: v.string(),
  }),
  examples: {
    response: {
      status: 'ok',
      sha: 'abc123',
      env: 'production',
      timestamp: '2026-07-30T12:00:00.000Z',
    },
  },
})
```

Auth (Valibot schemas — keep success bodies honest but not every Better Auth field):

- `POST /api/auth/sign-in/email` — public — input `{ email, password }` — output at least `{ token: v.optional(v.string()), user: v.optional(v.any()), session: v.optional(v.any()) }` — description explains Bearer token + cookie — example request with demo-shaped email — errorResponses 401/403
- `POST /api/auth/sign-up/email` — public — input `{ name, email, password }` — same output family — note 422 may auto sign-in via server handler
- `POST /api/auth/sign-out` — authenticated — output `v.object({})` or `v.any()` — description clears session
- `GET /api/auth/get-session` — public (returns null session when anon) — output `v.nullable(v.object({ session: v.optional(v.any()), user: v.optional(v.any()) }))` — refine after one live hit if needed
- `POST /api/auth/validateToken` — public — input `{ token: string }` — output `{ valid: boolean }`

Do **not** use `v.any()` in a way that breaks `toJsonSchema`; if it does, use `v.record(v.string(), v.unknown())` or explicit optional fields. Prefer explicit fields from a captured Better Auth response over `any`.

- [ ] **Step 1: Implement auth.ts + health.ts and import from load.ts**

- [ ] **Step 2: Regenerate**

Run: `bun run docs:openapi`

Expected: paths include `/api/health` and the five auth ops; tags include `auth` / `health`.

- [ ] **Step 3: Commit**

```bash
git add src/api/openapi src/api/openapi-v1.json
git commit -m "feat: document auth and health in openapi"
```

---

### Task 5: Enrich v1 defineRoute docs + events SSE

**Files:**
- Modify every existing `defineRoute` in:
  - `src/api/v1/handshake.ts`
  - `app/api/v1/transactions+api.ts`
  - `app/api/v1/users/me+api.ts`
  - `app/api/v1/users/username-available+api.ts`
  - `app/api/v1/users/business-settings+api.ts`
  - `app/api/v1/notifications+api.ts`
  - `app/api/v1/notifications/[id]+api.ts`
  - `app/api/v1/devices+api.ts`
  - `app/api/v1/submissions/quarterly+api.ts`
- Create: `src/api/openapi/events.ts` — `registerRoute` for SSE (eventsHandler is not defineRoute)
- Modify: `load.ts` — import `./events`

**Quality bar per route:** `description` (2–5 sentences), `security: 'public'` only on handshake, `errorResponses` with 401 for authed routes using `errorResponseSchema` from `~/contract`, at least one `examples.response` on handshake, users/me, transactions list, business-settings, devices, notifications list, quarterly enqueue.

Events registration:

```ts
registerRoute({
  method: 'GET',
  path: '/api/v1/events',
  summary: 'Subscribe to user events (SSE)',
  description:
    'Authenticated server-sent events stream. Sends a connected event, periodic heartbeats, and JSON payloads when user entities change. Not for Scalar Try-it long-polling — use EventSource or curl -N.',
  tags: ['events'],
  security: 'bearer',
  successContentType: 'text/event-stream',
  output: v.object({
    type: v.string(),
    at: v.optional(v.number()),
    message: v.optional(v.string()),
  }),
  examples: {
    response: { type: 'connected' },
  },
  errorResponses: [
    { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
  ],
})
```

- [ ] **Step 1: Add descriptions/examples/security to all v1 defineRoute call sites**

- [ ] **Step 2: Add events.ts + load import**

- [ ] **Step 3: Regenerate + unit tests still pass**

Run: `bun run docs:openapi && bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/openapiBuildSpec.test.ts`

- [ ] **Step 4: Commit**

```bash
git add app/api/v1 src/api/v1/handshake.ts src/api/openapi src/api/openapi-v1.json
git commit -m "docs: enrich v1 openapi descriptions and document sse events"
```

---

### Task 6: Shared legacy transaction DTO schema + Plaid + legacy transactions

**Files:**
- Create: `src/api/openapi/schemas/mtdTransactionDto.ts` — Valibot mirror of `src/features/plaid/types.ts` `MtdTransactionDto`
- Create: `src/api/openapi/plaid.ts`
- Create: `src/api/openapi/transactions.ts`
- Modify: `load.ts`

**Schemas:** Read `src/features/plaid/types.ts` and encode every field in Valibot (no `any`). Use that schema for plaid list responses and legacy transaction mutate responses.

**Register every op from the inventory:**

Plaid (all authed unless noted):
- `GET /api/plaid/accounts`
- `PATCH /api/plaid/accounts/{id}`
- `DELETE /api/plaid/accounts/{id}`
- `POST /api/plaid/import-ofx`
- `GET /api/plaid/status`
- `GET /api/plaid/transactions` (query: limit, offset, filter, sort, excludeReviewed, reviewedOnly, bankAccountId — match `app/api/plaid/transactions+api.ts`)
- `DELETE /api/plaid/transactions`

Legacy transactions:
- `PATCH /api/transactions`
- `POST /api/transactions/approve`
- `POST /api/transactions/manual`
- `PATCH /api/transactions/manual`
- `DELETE /api/transactions/manual`

Each gets description + 401 errorResponse + one example on status and on PATCH category.

Extract request bodies from the handler files listed in the inventory (do not invent fields). If a handler uses `as { ... }`, replace that cast with a shared Valibot schema imported by both the handler and the OpenAPI registration **when practical in this task**; minimum bar is accurate OpenAPI schemas even if handler still casts (prefer dual-use schema).

- [ ] **Step 1: Add mtdTransactionDto schema + plaid.ts + transactions.ts + load imports**

- [ ] **Step 2: Regenerate**

Run: `bun run docs:openapi`

Expected: all plaid + legacy transaction paths present.

- [ ] **Step 3: Commit**

```bash
git add src/api/openapi src/api/openapi-v1.json app/api/plaid app/api/transactions app/api/transactions+api.ts
git commit -m "feat: document plaid and legacy transaction apis in openapi"
```

---

### Task 7: HMRC OpenAPI registrations

**Files:**
- Create: `src/api/openapi/hmrc.ts`
- Optionally create: `src/api/openapi/schemas/hmrc.ts` mirroring `src/features/hmrc/types.ts`
- Modify: `load.ts`

**Register (from inventory):**
- `POST /api/hmrc/authorize` — authed — body `{ nino, platform?, returnTo? }`
- `GET /api/hmrc/businesses` — authed
- `POST /api/hmrc/businesses` — authed
- `GET /api/hmrc/callback` — **public** — query `code`, `state`, `error?` — successContentType not JSON: document `responses.302` via `errorResponses`-style custom or a dedicated `responses` extension — if `buildSpec` only supports errorResponses + 200, extend `RouteSpec` with `successStatus?: number` and empty/redirect description for 302 (add a unit test in buildSpec for `successStatus: 302` without JSON body)
- `POST /api/hmrc/callback` — authed — `{ code, state }` → `{ connected: true, nino }`
- `DELETE /api/hmrc/disconnect`
- `GET /api/hmrc/obligations`
- `GET /api/hmrc/status`
- `GET /api/hmrc/tax-estimate` — query `taxYearStart?`

If `successStatus` is needed, add it in this task with a failing test first (same TDD loop as Task 1, small extension).

- [ ] **Step 1: Extend buildSpec for redirect success if required (TDD)**

- [ ] **Step 2: Implement hmrc.ts + load import + regenerate**

- [ ] **Step 3: Commit**

```bash
git add src/api/openapi src/api/openapi-v1.json src/test/unit/openapiBuildSpec.test.ts
git commit -m "feat: document hmrc apis in openapi"
```

---

### Task 8: Submissions, mileage, categorisation

**Files:**
- Create: `src/api/openapi/submissions.ts`
- Create: `src/api/openapi/mileage.ts`
- Create: `src/api/openapi/categorisation.ts`
- Create schemas under `src/api/openapi/schemas/` as needed from:
  - `src/features/submission/server/submissionService.ts` (`QuarterlySummary`)
  - `src/features/submission/reviewFinancialEstimates.ts` (`ReviewFinancialSummary`)
  - categorisation `toRuleDto` in the rules handler/service
- Modify: `load.ts`

**Register all inventory ops** for:
- `GET /api/submissions/overview`
- `POST /api/submissions/quarterly` (+ 400/409 errors)
- `DELETE /api/submissions/quarterly` (note admin/demo gate in description)
- `GET /api/submissions/quarterly-summary`
- `GET /api/submissions/review-summary`
- mileage GET/POST/PATCH/DELETE
- categorisation rules GET/POST/PATCH/DELETE + stats GET

Nested summary objects may be large — still encode real fields; do not collapse to `type: object` with no properties.

- [ ] **Step 1: Implement the three domain files + schemas + load imports**

- [ ] **Step 2: Regenerate**

- [ ] **Step 3: Commit**

```bash
git add src/api/openapi src/api/openapi-v1.json
git commit -m "feat: document submissions mileage and categorisation in openapi"
```

---

### Task 9: File + stats + enable coverage check in CI

**Files:**
- Create: `src/api/openapi/file.ts` — **POST only** for `/api/file/receipt` and `/api/file/upload` with `requestContentType: 'multipart/form-data'`
- Create: `src/api/openapi/stats.ts` — public; document discriminated `action` union as Valibot `v.variant` / `v.union` matching `app/api/stats+api.ts`
- Modify: `load.ts`
- Modify: `scripts/check/openapi-coverage.ts` — final allowlist = phantom file methods only; auth catch-all handled by documented ops rule
- Wire check: ensure `bun check` picks up `scripts/check/openapi-coverage.ts` the same way as other `scripts/check/*.ts` (it auto-includes parallel scripts — confirm via `scripts/check` runner / `package.json` `check` script; if checks are explicit, add this one)

- [ ] **Step 1: Implement file.ts + stats.ts + load**

- [ ] **Step 2: Regenerate**

- [ ] **Step 3: Run coverage check — expect PASS**

Run: `bun run ./scripts/check/openapi-coverage.ts`

Expected: exit 0; if missing ops printed, fix registrations before continuing.

- [ ] **Step 4: Run broader verify**

Run: `bun check`

Expected: PASS (or fix types/lint from new files)

- [ ] **Step 5: Commit**

```bash
git add src/api/openapi src/api/openapi-v1.json scripts/check/openapi-coverage.ts
git commit -m "feat: document file and stats apis; enforce openapi coverage"
```

---

### Task 10: Staging/api-service docs note + Scalar spot-check

**Files:**
- Modify: `docs/staging.md` + `.claude/skills/staging/SKILL.md` (keep identical)
- Modify: `docs/api-service.md` + `.claude/skills/api-service/SKILL.md` (keep identical)

**Content to add (short paragraphs, no hard-wrap):**
- `/docs` OpenAPI covers the full api-service surface including auth.
- To try protected routes: sign in via `POST /api/auth/sign-in/email`, copy `token`, set Bearer in Scalar.
- Remind Cloudflare Access on `/docs` ≠ API auth.

- [ ] **Step 1: Update the four doc/skill files**

- [ ] **Step 2: Local Scalar smoke (optional if env available)**

Run: `bun run api-docs` (or `api-docs:build` + serve). Confirm overview markdown renders, auth tag exists, download still works.

- [ ] **Step 3: Commit**

```bash
git add docs/staging.md docs/api-service.md .claude/skills/staging/SKILL.md .claude/skills/api-service/SKILL.md
git commit -m "docs: note full openapi surface and bearer try-it flow"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Full api-service coverage excl. `/api/og` | 4–9 + coverage check |
| Auth first-class ops + cookie/Bearer story | 2 (info), 4 |
| Rich info.description, servers, tags, securitySchemes | 1–2 |
| Per-op descriptions, examples, errors | 5–9 |
| Field-level schemas / handler schema extraction | 6–8 |
| Generator upgrades | 1–2 |
| Manifest coverage check | 3, 9 |
| No Postman collection | honored |
| Docs note for testers | 10 |
| Sequenced delivery OK | tasks 1→10 |

No TBD placeholders remain in task steps. `successStatus` for HMRC redirect is an explicit Task 7 extension with TDD.
