# API Decoupling + Modular-Monolith Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the HTTP API from a standalone Bun process (its own build artifact `dist/api.js`, its own Docker service, its own subdomain `api.curatormtd.co.uk`) while keeping a single codebase whose client/server boundary is enforced by lint — so the API is independently deployable/scalable/versionable and the web app is not shipped.

**Architecture:** This is **Option B** (true standalone process) realised as a **modular monolith**: one repo, one `bun install`, but (a) a new `src/server/**` module builds a router from a **generated route manifest** that imports the existing `app/api/**/*+api.ts` `Endpoint` exports, (b) a client-safe `src/contract/**` surface holds the versioned schemas + version logic, and (c) an oxlint boundary rule forbids client code from importing server internals. The standalone entry is bundled exactly like the existing `worker` (`bun build ... --conditions react-server`) so `server-only` modules load under plain Bun. Deployment adds an `api` service to the uncloud compose file, routed to the API subdomain; the API service owns DB migrations.

**Tech Stack:** Bun 1.3.9 (`Bun.serve`), vxrn/One (`Endpoint` type, existing `app/api` routes), valibot + `@valibot/to-json-schema`, better-auth (`authServer.handler`), oxlint (`.oxlintrc.json`), uncloud (Docker Compose), vitest (unit tests in `src/test/unit/**`).

## Global Constraints

- Never delete `bun.lock`.
- Locked design decisions (do not re-litigate): single API service (Option B, standalone process); single evolving `/api/v1` contract (no concurrent versions); modular monolith (no full physical package split — enforce the boundary with lint instead).
- Unit tests MUST live under `src/test/unit/**/*.test.ts(x)` — that is the only path the vitest config (`src/test/vitest.config.ts`) includes for `src/`. A test placed elsewhere under `src/` will silently not run.
- Run tests with: `bun run:dev vitest run -c ./src/test/vitest.config.ts <file>`.
- The route `Endpoint` contract is `(request: Request, ctx?: { params?: Record<string,string> }) => Response | Promise<Response>` (from `one`). Do not change route files' signatures.
- The standalone server MUST listen on port `8081` (matches the compose healthcheck `curl -f http://localhost:8081/api/health`). Read `Number(process.env.PORT ?? 8081)`.
- Use `console.info()` not `console.log()`; few, lowercase comments; `~` import alias in `src/`, relative in `packages/*` and `scripts/*`.
- After code changes run `bun lint:fix && bun tko check types`; unit tests via the command above.
- Commit style: Conventional Commits, lowercase, one line, no co-author.

---

## File Structure

**New files:**
- `src/contract/version.ts` — moved from `src/constants/contract.ts` (API_CONTRACT_VERSION, API_VERSION_PREFIX, COMPATIBILITY, classifyAppVersion, HandshakeStatus). Client-safe.
- `src/contract/schemas.ts` — moved from `src/api/schemas.ts` (valibot request/response schemas). Client-safe.
- `src/contract/index.ts` — barrel re-exporting `./version` and `./schemas`.
- `src/server/router.ts` — pure router: `matchRoute()` + `createApiFetch()` (CORS + method/404 handling + error envelope).
- `src/server/routeManifest.generated.ts` — GENERATED. `export const apiRouteManifest: ApiRoute[]` importing every `app/api/**/*+api.ts` handler export.
- `src/server/api-entry.ts` — the bundled standalone entry (`Bun.serve`, `import.meta.main` guard).
- `scripts/api/gen-route-manifest.ts` — codegen that (re)writes `routeManifest.generated.ts` from the `app/api` tree.
- `scripts/check/api-manifest.ts` — check step: regenerate the manifest and fail if it differs from the committed file (auto-run by `bun check`).
- `src/test/unit/apiRouter.test.ts` — router unit tests.
- `docs/api-service.md` — runbook for the standalone API service.

**Modified files:**
- `src/api/v1/handshake.ts`, `scripts/docs/gen-openapi.ts` — update `~/constants/contract` → `~/contract`.
- `src/api/openapiManifest.ts` + the six v1 route files that import `~/api/schemas` — update to `~/contract`.
- `tsconfig.json` — add `~contract` path alias (optional convenience) — see Task 1.
- `.oxlintrc.json` — add the client→server import-boundary rule + reconcile existing overrides.
- `package.json` — add scripts: `api:manifest`, `api:build`, `api:serve`.
- `Dockerfile` — bundle `dist/api.js` alongside `dist/worker.js`.
- `src/constants/urls.ts` — introduce `API_BASE_URL` (API host, separate from web origin).
- `src/features/api/client/apiFetch.ts` — call `API_BASE_URL`, attach bearer token for cross-origin native auth.
- `src/features/auth/server/authServer.ts` — fix `crossSubDomainCookies` domain (`.tamagui.dev` → `.${DOMAIN}`) and add the API/app origins to `trustedOrigins`.
- `src/env.ts` — add `API_SERVER_URL` (server) + `VITE_API_HOSTNAME` (client) vars; run `bun env:update` after.
- `src/uncloud/docker-compose.yml` — add the `api` service.
- `scripts/uncloud/deploy-prod.ts` (or the shared core from the staging plan) — deploy the `api` service; move migration ownership to it.

---

## Task 1: Client-safe contract surface (`src/contract`)

**Files:**
- Create: `src/contract/version.ts`, `src/contract/schemas.ts`, `src/contract/index.ts`
- Delete: `src/constants/contract.ts`, `src/api/schemas.ts`
- Modify: `src/api/v1/handshake.ts`, `scripts/docs/gen-openapi.ts`, `src/api/openapiManifest.ts`, `app/api/v1/transactions+api.ts`, `app/api/v1/users/me+api.ts`, `app/api/v1/users/business-settings+api.ts`, `app/api/v1/notifications+api.ts`, `app/api/v1/notifications/[id]+api.ts`, `app/api/v1/devices+api.ts`, `tsconfig.json`

**Interfaces:**
- Produces: module `~/contract` re-exporting `API_CONTRACT_VERSION: number`, `API_VERSION_PREFIX: 'v1'`, `COMPATIBILITY`, `classifyAppVersion(appVersion: string): HandshakeStatus`, `HandshakeStatus`, and all valibot schemas previously in `src/api/schemas.ts` (`handshakeResponseSchema`, `mtdTransactionSchema`, `notificationSchema`, `deviceSchema`, `userPublicSchema`, `userStateSchema`, `listResponseSchema`, etc.).

- [ ] **Step 1: Move contract version logic**

Create `src/contract/version.ts` with the exact current contents of `src/constants/contract.ts`, changing only the `APP_VERSION` import path:

```ts
import { APP_VERSION } from '~/constants/app'

/** Bump when REST request/response shapes change incompatibly. */
export const API_CONTRACT_VERSION = 1

export const API_VERSION_PREFIX = 'v1' as const

export const COMPATIBILITY = {
  minSupportedAppVersion: '0.0.0',
  deprecatedBelow: '0.0.0',
  currentAppVersion: APP_VERSION,
} as const

export type HandshakeStatus = 'ok' | 'deprecated' | 'blocked'

export function classifyAppVersion(appVersion: string): HandshakeStatus {
  const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [aMaj, aMin, aPatch] = parse(appVersion)
  const [minMaj, minMin, minPatch] = parse(COMPATIBILITY.minSupportedAppVersion)
  const [depMaj, depMin, depPatch] = parse(COMPATIBILITY.deprecatedBelow)

  const cmp = (
    maj: number,
    min: number,
    patch: number,
    bMaj: number,
    bMin: number,
    bPatch: number,
  ) => {
    if (maj !== bMaj) return maj - bMaj
    if (min !== bMin) return min - bMin
    return patch - bPatch
  }

  if (cmp(aMaj, aMin, aPatch, minMaj, minMin, minPatch) < 0) return 'blocked'
  if (cmp(aMaj, aMin, aPatch, depMaj, depMin, depPatch) < 0) return 'deprecated'
  return 'ok'
}
```

- [ ] **Step 2: Move schemas**

`git mv src/api/schemas.ts src/contract/schemas.ts`. Open `src/contract/schemas.ts` and fix any relative/`~` imports it makes (it should only import `valibot`; leave as-is if so).

- [ ] **Step 3: Add barrel**

Create `src/contract/index.ts`:

```ts
export * from './version'
export * from './schemas'
```

- [ ] **Step 4: Delete the old contract file and update importers**

Delete `src/constants/contract.ts`. Update the two importers to `~/contract`:

- `src/api/v1/handshake.ts`: change `from '~/constants/contract'` → `from '~/contract'`.
- `scripts/docs/gen-openapi.ts`: change `from '~/constants/contract'` → `from '~/contract'`.

- [ ] **Step 5: Update schema importers**

In each of these files change `from '~/api/schemas'` → `from '~/contract'`:
`src/api/openapiManifest.ts`, `app/api/v1/transactions+api.ts`, `app/api/v1/users/me+api.ts`, `app/api/v1/users/business-settings+api.ts`, `app/api/v1/notifications+api.ts`, `app/api/v1/notifications/[id]+api.ts`, `app/api/v1/devices+api.ts`.

Then confirm none remain:

Run: `rg -n "~/api/schemas|~/constants/contract" src app scripts`
Expected: no matches.

- [ ] **Step 6: Add `~contract` alias (optional convenience) and typecheck**

In `tsconfig.json` `compilerOptions.paths`, alongside the existing `~/*`, add:

```json
"~contract": ["./src/contract/index.ts"],
"~contract/*": ["./src/contract/*"]
```

Run: `bun tko check types`
Expected: no new errors (the move is import-only).

- [ ] **Step 7: Regenerate the OpenAPI snapshot (paths unchanged, import moved)**

Run: `bun run docs:openapi`
Expected: `src/api/openapi-v1.json` regenerated; `git diff --stat src/api/openapi-v1.json` shows no semantic change (only re-serialization at most).

- [ ] **Step 8: Commit**

```bash
git add -A src/contract src/api src/constants scripts/docs app/api tsconfig.json src/api/openapi-v1.json
git commit -m "refactor(contract): carve client-safe src/contract surface"
```

---

## Task 2: Enforce the client/server boundary in oxlint

**Files:**
- Modify: `.oxlintrc.json`

**Interfaces:**
- Produces: a lint rule that fails `bun lint` if any client file imports a server-only module.

Server-only import prefixes to forbid from client code: `~/features/*/server/*`, `~/database/*`, `~/jobs/*`, `~/server/*`, `~/api/*` (note: the client-safe surface is `~/contract`, NOT `~/api`). Client directories to guard: `src/interface/**`, `src/hooks/**`, `src/tamagui/**`, `src/posthog/**`, and `src/features/**` files that are NOT under a `server/` subfolder.

- [ ] **Step 1: Add an override that bans server imports from client code**

Add to the `overrides` array in `.oxlintrc.json` a new entry. Because two existing overrides (`src/interface/**`, `**/*.native.*`) currently set `no-restricted-imports` to `"off"`, use a distinct rule that they don't disable — `import/no-restricted-paths` is not available in oxlint, so instead express the boundary with a dedicated `no-restricted-imports` block scoped to client globs and ensure it is ordered AFTER the disabling overrides (later overrides win):

```json
{
  "files": [
    "src/interface/**",
    "src/hooks/**",
    "src/tamagui/**",
    "src/posthog/**"
  ],
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          { "group": ["~/features/*/server/*", "~/features/*/server"], "message": "client code must not import server modules; use ~/contract or a client hook" },
          { "group": ["~/database/*", "~/database"], "message": "client code must not import the database layer" },
          { "group": ["~/jobs/*", "~/jobs"], "message": "client code must not import background jobs" },
          { "group": ["~/server/*", "~/server"], "message": "client code must not import the standalone server" },
          { "group": ["~/api/*", "~/api"], "message": "import API types/schemas from ~/contract, not ~/api" }
        ]
      }
    ]
  }
}
```

Note: oxlint applies overrides top-to-bottom with later entries taking precedence. Place this override LAST in the array so it re-enables the boundary for `src/interface/**` even though an earlier override disabled `no-restricted-imports` there. Keep the earlier `tamagui`-specific `paths` restriction working for other files via the top-level rule.

- [ ] **Step 2: Run lint to confirm zero violations (boundary already clean)**

Run: `bun lint`
Expected: PASS with no `no-restricted-imports` errors (verified: `src/interface/**` imports no server modules today).

- [ ] **Step 3: Prove the rule bites (temporary negative check)**

Temporarily add `import { getDb } from '~/database/db'` to the top of any file under `src/interface/` (e.g. a scratch import in an existing component), then:

Run: `bun lint`
Expected: FAIL with the "client code must not import the database layer" message.
Then remove the temporary import and re-run `bun lint` → PASS.

- [ ] **Step 4: Commit**

```bash
git add .oxlintrc.json
git commit -m "chore(lint): enforce client/server import boundary"
```

---

## Task 3: The API router (pure, unit-tested)

**Files:**
- Create: `src/server/router.ts`
- Test: `src/test/unit/apiRouter.test.ts`

**Interfaces:**
- Produces:
  - `type ApiRoute = { method: HttpMethod; pattern: string; handler: Endpoint }` where `HttpMethod = 'GET'|'POST'|'PATCH'|'PUT'|'DELETE'` and `Endpoint` is imported from `one`.
  - `matchRoute(routes: ApiRoute[], method: string, pathname: string): { route: ApiRoute; params: Record<string,string> } | null`
  - `createApiFetch(routes: ApiRoute[], opts: { corsOrigins: string[] }): (request: Request) => Promise<Response>`
- Pattern grammar: static segments match literally; `:name` captures one segment; a trailing `*` captures the remainder (used for `/api/auth/*`). Match precedence: more static segments first, then `:param`, then `*`.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/apiRouter.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { createApiFetch, matchRoute, type ApiRoute } from '~/server/router'

const ok = (body: string) =>
  ((async () => new Response(body)) as unknown as ApiRoute['handler'])

const routes: ApiRoute[] = [
  { method: 'GET', pattern: '/api/health', handler: ok('health') },
  { method: 'GET', pattern: '/api/v1/notifications', handler: ok('list') },
  {
    method: 'GET',
    pattern: '/api/v1/notifications/:id',
    handler: (async (_req: Request, ctx: { params?: Record<string, string> }) =>
      new Response(ctx.params?.id ?? '')) as unknown as ApiRoute['handler'],
  },
  { method: 'POST', pattern: '/api/auth/*', handler: ok('auth') },
]

describe('matchRoute', () => {
  it('matches a static route', () => {
    const m = matchRoute(routes, 'GET', '/api/health')
    expect(m?.route.pattern).toBe('/api/health')
    expect(m?.params).toEqual({})
  })

  it('prefers the static list route over the :id route', () => {
    const m = matchRoute(routes, 'GET', '/api/v1/notifications')
    expect(m?.route.pattern).toBe('/api/v1/notifications')
  })

  it('captures a path param', () => {
    const m = matchRoute(routes, 'GET', '/api/v1/notifications/abc')
    expect(m?.route.pattern).toBe('/api/v1/notifications/:id')
    expect(m?.params).toEqual({ id: 'abc' })
  })

  it('matches a catch-all', () => {
    const m = matchRoute(routes, 'POST', '/api/auth/sign-in/email')
    expect(m?.route.pattern).toBe('/api/auth/*')
  })

  it('returns null for an unknown path', () => {
    expect(matchRoute(routes, 'GET', '/api/nope')).toBeNull()
  })
})

describe('createApiFetch', () => {
  const fetchApi = createApiFetch(routes, { corsOrigins: ['https://app.curatormtd.co.uk'] })

  it('invokes the matched handler and passes params', async () => {
    const res = await fetchApi(new Request('https://api.curatormtd.co.uk/api/v1/notifications/xyz'))
    expect(await res.text()).toBe('xyz')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await fetchApi(new Request('https://api.curatormtd.co.uk/api/nope'))
    expect(res.status).toBe(404)
  })

  it('returns 405 when the path matches but the method does not', async () => {
    const res = await fetchApi(
      new Request('https://api.curatormtd.co.uk/api/health', { method: 'DELETE' }),
    )
    expect(res.status).toBe(405)
  })

  it('answers CORS preflight for an allowed origin', async () => {
    const res = await fetchApi(
      new Request('https://api.curatormtd.co.uk/api/v1/notifications', {
        method: 'OPTIONS',
        headers: { origin: 'https://app.curatormtd.co.uk', 'access-control-request-method': 'GET' },
      }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.curatormtd.co.uk')
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('sets an error envelope when the handler throws', async () => {
    const boom: ApiRoute[] = [
      {
        method: 'GET',
        pattern: '/api/boom',
        handler: (async () => {
          throw new Error('kaboom')
        }) as unknown as ApiRoute['handler'],
      },
    ]
    const f = createApiFetch(boom, { corsOrigins: [] })
    const res = await f(new Request('https://api.curatormtd.co.uk/api/boom'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'kaboom' })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/apiRouter.test.ts`
Expected: FAIL — `~/server/router` does not exist.

- [ ] **Step 3: Implement the router**

Create `src/server/router.ts`:

```ts
import type { Endpoint } from 'one'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export type ApiRoute = {
  method: HttpMethod
  pattern: string
  handler: Endpoint
}

type Compiled = ApiRoute & { segments: string[]; catchAll: boolean }

function compile(routes: ApiRoute[]): Compiled[] {
  return routes
    .map((r) => {
      const segments = r.pattern.split('/').filter(Boolean)
      const catchAll = segments.at(-1) === '*'
      return { ...r, segments, catchAll }
    })
    .sort((a, b) => {
      // more specific first: static beats param beats catch-all
      const score = (s: Compiled) =>
        s.segments.reduce(
          (acc, seg) => acc + (seg === '*' ? 0 : seg.startsWith(':') ? 1 : 2),
          0,
        )
      return score(b) - score(a)
    })
}

export function matchRoute(
  routes: ApiRoute[],
  method: string,
  pathname: string,
): { route: ApiRoute; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter(Boolean)
  for (const r of compile(routes)) {
    if (r.method !== method) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < r.segments.length; i++) {
      const seg = r.segments[i]
      if (seg === '*') {
        break // catch-all matches the rest
      }
      const part = parts[i]
      if (part === undefined) {
        ok = false
        break
      }
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(part)
      } else if (seg !== part) {
        ok = false
        break
      }
    }
    if (ok && (r.catchAll || parts.length === r.segments.length)) {
      return { route: r, params }
    }
  }
  return null
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-app-version',
    vary: 'Origin',
  }
}

export function createApiFetch(routes: ApiRoute[], opts: { corsOrigins: string[] }) {
  const pathMethods = (pathname: string) =>
    routes.filter((r) => matchRoute([{ ...r }], r.method, pathname))

  return async function apiFetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    const cors = corsHeaders(origin, opts.corsOrigins)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const match = matchRoute(routes, request.method, url.pathname)
    if (!match) {
      // distinguish 405 (path exists, wrong method) from 404
      const anyMethod = pathMethods(url.pathname).length > 0
      return Response.json(
        { error: anyMethod ? 'method not allowed' : 'not found' },
        { status: anyMethod ? 405 : 404, headers: cors },
      )
    }

    try {
      const res = await match.route.handler(request, { params: match.params })
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
      return res
    } catch (error) {
      const message = error instanceof Error ? error.message : 'internal server error'
      console.error(`[api] ${request.method} ${url.pathname}`, error)
      return Response.json({ error: message }, { status: 500, headers: cors })
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/apiRouter.test.ts`
Expected: PASS (all matchRoute + createApiFetch cases).

- [ ] **Step 5: Lint + typecheck**

Run: `bun lint:fix && bun tko check types`
Expected: no new errors in `src/server/*`.

- [ ] **Step 6: Commit**

```bash
git add src/server/router.ts src/test/unit/apiRouter.test.ts
git commit -m "feat(api): add standalone api router with cors and param matching"
```

---

## Task 4: Route-manifest codegen + drift check

**Files:**
- Create: `scripts/api/gen-route-manifest.ts`, `scripts/check/api-manifest.ts`
- Create (generated): `src/server/routeManifest.generated.ts`
- Modify: `package.json` (add `api:manifest` script)

**Interfaces:**
- Produces: `export const apiRouteManifest: ApiRoute[]` in `routeManifest.generated.ts`, one entry per exported HTTP method across all `app/api/**/*+api.ts` files.
- Consumes: `ApiRoute` from `~/server/router`.
- Pattern derivation from file path: strip `app/api` prefix and `+api.ts` suffix → `/api/<rest>`; `[x]` → `:x`; `[...x]` → `*`.

- [ ] **Step 1: Write the codegen script**

Create `scripts/api/gen-route-manifest.ts`:

```ts
#!/usr/bin/env bun

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const API_DIR = join(ROOT, 'app/api')
const OUT = join(ROOT, 'src/server/routeManifest.generated.ts')
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p))
    else if (entry.name.endsWith('+api.ts')) out.push(p)
  }
  return out
}

function patternFor(file: string): string {
  const rel = relative(API_DIR, file).replace(/\+api\.ts$/, '')
  const segs = rel
    .split('/')
    .map((s) => s.replace(/^\[\.\.\.(.+)\]$/, '*').replace(/^\[(.+)\]$/, ':$1'))
  return `/api/${segs.join('/')}`.replace(/\/$/, '')
}

// NOTE: parse the route files as text rather than `await import(file)`.
// route modules transitively import `~/database/db` which does `import 'server-only'`,
// and `server-only` throws under plain `bun run` (no react-server condition). the
// generated manifest still statically imports them — that file is only ever bundled
// with `--conditions react-server` (api:build) or type-checked, never executed here.
function main() {
  const files = walk(API_DIR).sort()
  const imports: string[] = []
  const entries: string[] = []

  for (const [i, file] of files.entries()) {
    const src = readFileSync(file, 'utf8')
    const present = METHODS.filter((m) => new RegExp(`export\\s+const\\s+${m}\\b`).test(src))
    if (present.length === 0) continue
    const rel = relative(join(ROOT, 'src/server'), file).replace(/\.ts$/, '')
    const alias = `r${i}`
    imports.push(`import * as ${alias} from '${rel}'`)
    const pattern = patternFor(file)
    for (const m of present) {
      entries.push(`  { method: '${m}', pattern: '${pattern}', handler: ${alias}.${m} },`)
    }
  }

  const body = `// GENERATED by scripts/api/gen-route-manifest.ts — do not edit by hand.
// run: bun run api:manifest
import type { ApiRoute } from './router'

${imports.join('\n')}

export const apiRouteManifest: ApiRoute[] = [
${entries.join('\n')}
]
`
  writeFileSync(OUT, body)
  console.info(`[api] wrote ${entries.length} routes to ${relative(ROOT, OUT)}`)
}

main()
```

- [ ] **Step 2: Add the `api:manifest` script and generate**

In `package.json` `scripts`, add:

```json
"api:manifest": "bun run ./scripts/api/gen-route-manifest.ts",
```

Run: `bun run api:manifest`
Expected: writes `src/server/routeManifest.generated.ts` with ~45 entries (40 files, some with GET+POST). Log prints the count.

- [ ] **Step 3: Typecheck the generated file**

Run: `bun tko check types`
Expected: no errors — every `handler` resolves to an `Endpoint`. If a route file exports a non-`Endpoint` shape, fix the import in that route file (should not happen; all use `Endpoint`).

- [ ] **Step 4: Add a drift check that CI runs**

Create `scripts/check/api-manifest.ts` (auto-discovered by `bun check`):

```ts
#!/usr/bin/env bun

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const OUT = join(ROOT, 'src/server/routeManifest.generated.ts')

const before = readFileSync(OUT, 'utf8')
await import('../api/gen-route-manifest.ts')
const after = readFileSync(OUT, 'utf8')

if (before !== after) {
  console.error(
    '[check] route manifest is stale. run `bun run api:manifest` and commit the result.',
  )
  process.exit(1)
}
console.info('[check] route manifest up to date')
```

Run: `bun check`
Expected: PASS (types, knip, dependencies, lint, plus the new api-manifest check).

- [ ] **Step 5: Commit**

```bash
git add scripts/api/gen-route-manifest.ts scripts/check/api-manifest.ts src/server/routeManifest.generated.ts package.json
git commit -m "feat(api): generate standalone route manifest with drift check"
```

---

## Task 5: The standalone API entry + build wiring

**Files:**
- Create: `src/server/api-entry.ts`
- Modify: `package.json` (`api:build`, `api:serve`), `Dockerfile`

**Interfaces:**
- Consumes: `apiRouteManifest` (Task 4), `createApiFetch` (Task 3), CORS origins derived from env (`VITE_WEB_HOSTNAME`, `APP_SCHEME`, staging host).
- Produces: `dist/api.js` bundle; a process listening on `:8081` serving `/api/**`.

- [ ] **Step 1: Write the entry**

Create `src/server/api-entry.ts`:

```ts
import { APP_SCHEME } from '~/constants/app'
import { createApiFetch } from '~/server/router'
import { apiRouteManifest } from '~/server/routeManifest.generated'

function resolveCorsOrigins(): string[] {
  const origins = new Set<string>()
  const proto = process.env.VITE_PROTOCOL || 'https'
  const web = process.env.VITE_WEB_HOSTNAME
  if (web) origins.add(`${proto}://${web}`)
  // native custom scheme (e.g. curatormtd://) — used as Origin by some clients
  origins.add(`${APP_SCHEME}://`)
  // local dev
  origins.add('http://localhost:8081')
  return [...origins]
}

const port = Number(process.env.PORT ?? 8081)
const fetch = createApiFetch(apiRouteManifest, { corsOrigins: resolveCorsOrigins() })

if (import.meta.main) {
  Bun.serve({ port, fetch })
  console.info(`[api] standalone api listening on :${port} (${apiRouteManifest.length} routes)`)
}

export { fetch, port }
```

Note: confirm `APP_SCHEME` is exported from `~/constants/app` (it is referenced by `authServer.ts` trustedOrigins). If it is named differently, import the actual symbol.

- [ ] **Step 2: Add build + serve scripts**

In `package.json` `scripts`, add:

```json
"api:build": "bun build src/server/api-entry.ts --target bun --conditions react-server --outfile dist/api.js",
"api:serve": "bun run dist/api.js",
```

- [ ] **Step 3: Build the bundle locally**

Run: `bun run api:manifest && bun run api:build`
Expected: `dist/api.js` produced with no bundler errors (the `--conditions react-server` flag no-ops `server-only` and tree-shakes client React, exactly like the worker bundle).

- [ ] **Step 4: Smoke-test the standalone server against a local DB**

With a local Postgres/env available (see `bun backend`), run:

Run: `PORT=8091 bun run dist/api.js &` then `curl -fsS http://localhost:8091/api/health`
Expected: `{"status":"ok","sha":"...","timestamp":...}` (health handler needs no auth).
Then stop the process.

- [ ] **Step 5: Add the bundle step to the Dockerfile**

In `Dockerfile`, next to the worker bundle line, add the api bundle so the same image can run either service:

```dockerfile
RUN echo "api bundle for ${GIT_SHA}" && \
  bun run api:manifest && \
  bun build src/server/api-entry.ts --target bun --conditions react-server --outfile dist/api.js
```

(Place it after the existing worker-bundle `RUN`. Keep the existing `CMD ["bun","one","serve","--port","8081"]` — the `api` compose service overrides the command.)

- [ ] **Step 6: Lint + typecheck**

Run: `bun lint:fix && bun tko check types`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/server/api-entry.ts package.json Dockerfile
git commit -m "feat(api): add standalone bun api entry and build wiring"
```

---

## Task 6: Point the client at the API host + cross-origin auth

**Files:**
- Modify: `src/env.ts`, `src/constants/urls.ts`, `src/features/api/client/apiFetch.ts`, `src/features/auth/client/authFetch.ts`, `src/features/auth/server/authServer.ts`
- Run: `bun env:update` after editing `src/env.ts`

**Interfaces:**
- Produces: `API_BASE_URL` in `~/constants/urls` — the base URL for all `/api` calls (the API host), distinct from `SERVER_URL` (web origin). On native it resolves from `VITE_API_HOSTNAME`/`API_SERVER_URL`; in browser it falls back to same-origin.
- Server env: `API_SERVER_URL` (expected in production; e.g. `https://api.curatormtd.co.uk`). Client env: `VITE_API_HOSTNAME` (+ existing `VITE_PROTOCOL`).

- [ ] **Step 1: Add env vars**

In `src/env.ts`, mirror the existing `ONE_SERVER_URL` / `VITE_WEB_HOSTNAME` definitions:
- server: `API_SERVER_URL` — `expected` in production, dev default `http://localhost:${ports.web}`.
- client: `VITE_API_HOSTNAME` — dev default `localhost:8081`, production value `api.curatormtd.co.uk`.

Then sync compose/CI yml:

Run: `bun env:update`
Expected: `src/uncloud/docker-compose.yml` `x-app-env` block regenerated to include `API_SERVER_URL` and `VITE_API_HOSTNAME`.

- [ ] **Step 2: Derive `API_BASE_URL`**

In `src/constants/urls.ts`, add below `SERVER_URL`:

```ts
export const API_BASE_URL = (() => {
  // browser served by the api host itself, or dev same-origin
  if (typeof location !== 'undefined') {
    const host = import.meta.env.VITE_API_HOSTNAME
    if (host && host !== 'localhost:8081') {
      return `${import.meta.env.VITE_PROTOCOL || 'https'}://${host}`
    }
    return `${location.protocol}//${location.host}`
  }
  // native/server: prefer the baked api host, else fall back to SERVER_URL
  const host = import.meta.env.VITE_API_HOSTNAME
  if (host && host !== 'localhost:8081') {
    return `${import.meta.env.VITE_PROTOCOL || 'https'}://${host}`
  }
  return SERVER_URL
})()

export const API_URL = `${API_BASE_URL}/api`
export const AUTH_URL = `${API_BASE_URL}/api/auth`
```

Replace the existing `API_URL`/`AUTH_URL` definitions (which used `SERVER_URL`) with the ones above.

- [ ] **Step 3: Route `apiFetch` through the API host and attach the bearer token**

In `src/features/api/client/apiFetch.ts`:
- import `API_BASE_URL` from `~/constants/urls` (replace `SERVER_URL`).
- import the auth token accessor used by `authFetch` (the `authState.value?.session?.token` getter — extract it into a small exported helper `getAuthToken()` in `src/features/auth/client/authFetch.ts` if not already exported).
- change `fetch(\`${SERVER_URL}${path}\`)` → `fetch(\`${API_BASE_URL}${path}\`)`.
- add an `authorization: Bearer <token>` header when a token exists (native cross-origin cannot rely on cookies).

```ts
import { API_BASE_URL } from '~/constants/urls'
import { getAuthToken } from '~/features/auth/client/authFetch'

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers, ...rest } = init
  const token = getAuthToken()
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    credentials: 'include',
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  // ...unchanged response handling...
}
```

Add to `src/features/auth/client/authFetch.ts` (if not present):

```ts
export function getAuthToken(): string | undefined {
  return authState.value?.session?.token
}
```

- [ ] **Step 4: Point `authFetch` / better-auth client base at the API host**

In `src/features/auth/client/authFetch.ts`, change the `baseURL` fallback from `process.env.ONE_SERVER_URL` to the API host (`process.env.API_SERVER_URL || process.env.ONE_SERVER_URL`). In `src/features/auth/client/authClient.ts`, change `createBetterAuthClient({ baseURL: SERVER_URL })` → `baseURL: API_BASE_URL`.

- [ ] **Step 5: Fix cross-subdomain cookies + trusted origins on the server**

In `src/features/auth/server/authServer.ts`:
- change the hardcoded `crossSubDomainCookies.domain` from `.tamagui.dev` to `` `.${DOMAIN}` `` (i.e. `.curatormtd.co.uk`) so cookies are valid across `api.` and `app.` subdomains.
- ensure `trustedOrigins` includes the API host and the (future) web host: add `` `https://${DOMAIN}` ``, `` `https://api.${DOMAIN}` ``, `` `https://app.${DOMAIN}` `` and their staging equivalents (or derive from `API_SERVER_URL`/`BETTER_AUTH_URL`).

- [ ] **Step 6: Typecheck + unit tests + lint**

Run: `bun tko check types && bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/apiRouter.test.ts && bun lint:fix`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/env.ts src/constants/urls.ts src/features/api/client/apiFetch.ts src/features/auth/client/authFetch.ts src/features/auth/client/authClient.ts src/features/auth/server/authServer.ts src/uncloud/docker-compose.yml
git commit -m "feat(api): point client at api host with cross-origin bearer auth"
```

---

## Task 7: Deploy the `api` service (compose + uncloud)

**Files:**
- Modify: `src/uncloud/docker-compose.yml`, and the deploy routine (`scripts/uncloud/deploy-prod.ts`, or the shared `deploy-core.ts` from the staging plan)

**Interfaces:**
- Produces: an `api` compose service (same `mtd-web:latest` image, `command: ["bun","run","dist/api.js"]`) exposed at `api.curatormtd.co.uk:8081/https`; the API service runs DB migrations on deploy.

- [ ] **Step 1: Add the `api` service to compose**

In `src/uncloud/docker-compose.yml`, add alongside `web` and `worker`:

```yaml
  api:
    image: mtd-web:latest
    restart: always
    command: ["bun", "run", "dist/api.js"]
    x-ports:
      - ${VITE_API_HOSTNAME:-api.mtd.uncld.dev}:8081/https
    environment:
      <<: *app-env
      NODE_ENV: production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8081/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

- [ ] **Step 2: Deploy the api service and move migration ownership to it**

In the deploy routine (`deployStack` calls), add `api` to the deployed services (`deployStack(compose, { service: 'api', context })`). Keep `worker`. If the web app is not being shipped, remove `web` from the deploy list (or leave it and route only the api subdomain — decide per rollout). Ensure the migration step (currently run before deploy) still runs once against the shared DB — the API service is now the migration owner; document this in `docs/api-service.md`.

- [ ] **Step 3: Deploy to staging first (uses Plan: staging refocus)**

Run (staging context, after the staging plan is applied): `bun tko uncloud deploy-staging`
Expected: builds the image (now including `dist/api.js`), runs migrations, deploys `api` (+ `worker`), prints the api url.

- [ ] **Step 4: Verify the standalone API is reachable and isolated**

Run: `curl -fsS https://staging-api.curatormtd.co.uk/api/health`
Expected: HTTP 200 with the deployed `GIT_SHA`.
Run: `curl -fsS https://staging-api.curatormtd.co.uk/api/v1/handshake -H 'x-app-version: 0.0.0'`
Expected: `{"status":"ok","apiContract":1,...}`.

- [ ] **Step 5: Commit**

```bash
git add src/uncloud/docker-compose.yml scripts/uncloud/*.ts
git commit -m "feat(deploy): add standalone api service to uncloud"
```

---

## Task 8: Documentation

**Files:**
- Create: `docs/api-service.md`

- [ ] **Step 1: Write the runbook**

Document: the standalone API architecture (Option B, bundled `dist/api.js`, `Bun.serve` + generated manifest + router), how to add a route (create `app/api/**+api.ts`, run `bun run api:manifest`, commit the manifest), the client/server lint boundary (`~/contract` is the only client-visible API surface), the `api.curatormtd.co.uk` deployment, migration ownership, CORS/trusted-origins config, and the cross-origin bearer-auth model for native.

- [ ] **Step 2: Commit**

```bash
git add docs/api-service.md
git commit -m "docs: add standalone api service runbook"
```

---

## Risks & Notes

- **Manual manifest maintenance:** new routes require `bun run api:manifest`; the `scripts/check/api-manifest.ts` drift check makes a forgotten regen fail CI, so this can't silently rot.
- **`Bun.serve` vs custom fetch:** we use a custom `fetch` (not Bun's native `routes`) so CORS, 404/405, and error enveloping are handled uniformly and are unit-testable without a live socket.
- **Cross-origin auth:** native now sends `Authorization: Bearer` (reliable cross-origin); web (later) relies on cross-subdomain cookies, which requires the `.curatormtd.co.uk` cookie-domain fix in Task 6.5. Test web auth when the web app is actually shipped.
- **Fallback to Option A:** if the standalone router causes trouble in production, the `web` image can still serve `/api` via `one serve`; routing the api subdomain to a `one serve` service is a zero-code rollback.
- **One dev server still serves `/api` locally:** `bun dev` continues to work unchanged for local development; the standalone entry is only used for the deployed `api` service (and manual smoke tests).

## Self-Review

- Spec coverage: standalone process (Tasks 3–5), modular-monolith boundary (Tasks 1–2), generated manifest + drift guard (Task 4), client re-point + cross-origin auth (Task 6), deploy/subdomain/migration ownership (Task 7), docs (Task 8). All locked decisions covered.
- Placeholder scan: code steps contain full code; env/infra values (hostnames) are explicit; the one "confirm `APP_SCHEME` export" note is a verification, not a gap.
- Type consistency: `ApiRoute`, `matchRoute`, `createApiFetch` signatures are consistent across Task 3 (definition), Task 4 (manifest), and Task 5 (entry). `API_BASE_URL`/`API_URL`/`AUTH_URL` consistent across Task 6.
