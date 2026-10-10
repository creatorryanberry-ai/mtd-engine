# Staging API Docs + Cloudflare Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Scalar OpenAPI docs at `https://staging-api.curatormtd.co.uk/docs` from the standalone API image, with Cloudflare Access (Google, `@curator.org.uk`) gating only `/docs*` so preview/TestFlight `/api/**` traffic is unchanged.

**Architecture:** Build `api-docs/` to static files under `dist/api-docs/` with Vite `base: '/docs/'`. The API fetch handler serves those files for `/docs` and `/docs/*` before the route manifest. Auth is Cloudflare Access on path `/docs*` only (manual console setup); `/api/**` stays ungated. Orange-cloud staging DNS so Access can sit in front.

**Tech Stack:** Bun, Vite, `@scalar/api-reference`, vitest, Docker/`mtd-web` image, Cloudflare Zero Trust Access, Uncloud/Caddy ingress.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-staging-api-docs-access-design.md`
- Do not gate `/api/**` or add Access service tokens to the app
- Do not automate Cloudflare Access/DNS in deploy scripts (document manual steps)
- Prefer `console.info()`; few lowercase comments; Conventional Commits lowercase one-line, no co-author
- `docs/*.md` and matching `.claude/skills/*/SKILL.md` stay identical — update both when changing lasting docs
- After code changes: `bun check` (or at least unit tests for touched files)

---

## File Structure

**Create:**
- `src/server/serveApiDocs.ts` — resolve `/docs` + `/docs/*` to files under a docs root; return `Response | null`
- `src/test/unit/serveApiDocs.test.ts` — unit tests with a temp fixture directory

**Modify:**
- `api-docs/vite.config.ts` — production `base: '/docs/'`, `build.outDir` → `../dist/api-docs`
- `package.json` — add `api-docs:build` script
- `src/server/api-entry.ts` — try docs serve before `createApiFetch`
- `Dockerfile` — run `api-docs:build` so `dist/api-docs/` exists in the image
- `docs/staging.md` + `.claude/skills/staging/SKILL.md` — docs URL, Access, orange-cloud
- `docs/api-service.md` + `.claude/skills/api-service/SKILL.md` — API also serves `/docs` when built

**Manual (no code):**
- Cloudflare DNS proxy + Access application for `/docs*`

---

### Task 1: Static docs server (TDD)

**Files:**
- Create: `src/server/serveApiDocs.ts`
- Create: `src/test/unit/serveApiDocs.test.ts`

**Interfaces:**
- Produces:
  - `export function serveApiDocs(request: Request, docsRoot: string): Promise<Response | null>`
  - Path rules: only `GET`/`HEAD`; pathname must be `/docs` or start with `/docs/`; `/docs` and `/docs/` → `index.html`; reject `..` / path escape; missing file → `null` (caller falls through to API 404); set a sensible `Content-Type` from extension

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/serveApiDocs.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { serveApiDocs } from '~/server/serveApiDocs'

describe('serveApiDocs', () => {
  let root: string

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  function fixture(files: Record<string, string>) {
    root = mkdtempSync(join(tmpdir(), 'api-docs-'))
    for (const [rel, body] of Object.entries(files)) {
      const full = join(root, rel)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, body)
    }
    return root
  }

  it('serves index.html for /docs and /docs/', async () => {
    const docsRoot = fixture({ 'index.html': '<html>docs</html>' })
    for (const path of ['/docs', '/docs/']) {
      const res = await serveApiDocs(
        new Request(`https://staging-api.curatormtd.co.uk${path}`),
        docsRoot,
      )
      expect(res?.status).toBe(200)
      expect(await res!.text()).toBe('<html>docs</html>')
      expect(res!.headers.get('content-type')).toContain('text/html')
    }
  })

  it('serves nested assets under /docs/', async () => {
    const docsRoot = fixture({ 'assets/app.js': 'console.info(1)' })
    const res = await serveApiDocs(
      new Request('https://staging-api.curatormtd.co.uk/docs/assets/app.js'),
      docsRoot,
    )
    expect(res?.status).toBe(200)
    expect(await res!.text()).toBe('console.info(1)')
    expect(res!.headers.get('content-type')).toContain('javascript')
  })

  it('returns null for non-docs paths and non-GET methods', async () => {
    const docsRoot = fixture({ 'index.html': 'x' })
    expect(
      await serveApiDocs(
        new Request('https://staging-api.curatormtd.co.uk/api/health'),
        docsRoot,
      ),
    ).toBeNull()
    expect(
      await serveApiDocs(
        new Request('https://staging-api.curatormtd.co.uk/docs', { method: 'POST' }),
        docsRoot,
      ),
    ).toBeNull()
  })

  it('returns null when the file is missing', async () => {
    const docsRoot = fixture({ 'index.html': 'x' })
    expect(
      await serveApiDocs(
        new Request('https://staging-api.curatormtd.co.uk/docs/missing.js'),
        docsRoot,
      ),
    ).toBeNull()
  })

  it('rejects path escape attempts', async () => {
    const docsRoot = fixture({ 'index.html': 'x' })
    expect(
      await serveApiDocs(
        new Request('https://staging-api.curatormtd.co.uk/docs/../../etc/passwd'),
        docsRoot,
      ),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/serveApiDocs.test.ts`

Expected: FAIL — `~/server/serveApiDocs` does not exist

- [ ] **Step 3: Write minimal implementation**

Create `src/server/serveApiDocs.ts`:

```ts
import { existsSync } from 'node:fs'
import { extname, relative, resolve, sep } from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function resolveDocsFile(docsRoot: string, pathname: string): string | null {
  if (pathname !== '/docs' && !pathname.startsWith('/docs/')) return null

  const rel =
    pathname === '/docs' || pathname === '/docs/'
      ? 'index.html'
      : pathname.slice('/docs/'.length)

  if (!rel || rel.includes('\0') || rel.split(/[/\\]/).includes('..')) return null

  const root = resolve(docsRoot)
  const candidate = resolve(root, rel)
  const relToRoot = relative(root, candidate)
  if (!relToRoot || relToRoot.startsWith('..') || relToRoot.includes(`..${sep}`)) {
    return null
  }
  if (!existsSync(candidate)) return null
  return candidate
}

export async function serveApiDocs(
  request: Request,
  docsRoot: string,
): Promise<Response | null> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  if (!docsRoot || !existsSync(docsRoot)) return null

  const { pathname } = new URL(request.url)
  const filePath = resolveDocsFile(docsRoot, pathname)
  if (!filePath) return null

  const file = Bun.file(filePath)
  if (!(await file.exists())) return null

  const headers = { 'content-type': contentTypeFor(filePath) }
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers })
  }
  return new Response(file, { status: 200, headers })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/serveApiDocs.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/serveApiDocs.ts src/test/unit/serveApiDocs.test.ts
git commit -m "feat(api): serve static files for /docs"
```

---

### Task 2: Wire docs into api-entry

**Files:**
- Modify: `src/server/api-entry.ts`
- Test: reuse `src/test/unit/serveApiDocs.test.ts` (no new test file required); smoke via local serve after Task 3 if desired

**Interfaces:**
- Consumes: `serveApiDocs(request, docsRoot)`
- Docs root: `join(import.meta.dir, '../api-docs')` is wrong for the bundle — use `join(process.cwd(), 'dist/api-docs')` (Docker `WORKDIR /app`; local `api:serve` from repo root)

- [ ] **Step 1: Update api-entry to try docs first**

In `src/server/api-entry.ts`, wrap the fetch handler:

```ts
import { join } from 'node:path'

import { APP_SCHEME } from '~/features/auth/constants'
import { createApiFetch } from '~/server/router'
import { apiRouteManifest } from '~/server/routeManifest.generated'
import { serveApiDocs } from '~/server/serveApiDocs'

function resolveCorsOrigins(): string[] {
  const origins = new Set<string>()
  const proto = process.env.VITE_PROTOCOL || 'https'
  const web = process.env.VITE_WEB_HOSTNAME
  if (web) origins.add(`${proto}://${web}`)
  origins.add(`${APP_SCHEME}://`)
  origins.add('http://localhost:8081')
  origins.add('http://localhost:8082')
  return [...origins]
}

const port = Number(process.env.PORT ?? 8081)
const apiFetch = createApiFetch(apiRouteManifest, { corsOrigins: resolveCorsOrigins() })
const docsRoot = join(process.cwd(), 'dist/api-docs')

const fetch = async (request: Request): Promise<Response> => {
  const docs = await serveApiDocs(request, docsRoot)
  if (docs) return docs
  return apiFetch(request)
}

if (import.meta.main) {
  Bun.serve({ port, fetch })
  console.info(
    `[api] standalone api listening on :${port} (${apiRouteManifest.length} routes)`,
  )
}

export { fetch, port }
```

- [ ] **Step 2: Confirm API router tests still pass**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/apiRouter.test.ts src/test/unit/serveApiDocs.test.ts`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/server/api-entry.ts
git commit -m "feat(api): mount /docs static handler in api entry"
```

---

### Task 3: Vite production build for api-docs

**Files:**
- Modify: `api-docs/vite.config.ts`
- Modify: `package.json` (scripts)
- Modify: `api-docs/index.html` only if the script src needs a relative path after `base` (Vite usually rewrites on build)

**Interfaces:**
- Produces: `dist/api-docs/index.html` + hashed assets under `dist/api-docs/assets/`
- Script: `"api-docs:build": "bun run docs:openapi && vite build --config api-docs/vite.config.ts"`

- [ ] **Step 1: Update vite config for subdirectory deploy**

Replace `api-docs/vite.config.ts` with:

```ts
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vite'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root,
  base: '/docs/',
  server: {
    port: Number(process.env.VITE_PORT_API_DOCS ?? 6007),
    strictPort: true,
  },
  build: {
    outDir: resolve(root, '../dist/api-docs'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '~': resolve(root, '../src'),
    },
  },
  optimizeDeps: {
    include: ['@scalar/api-reference'],
  },
})
```

- [ ] **Step 2: Add package.json script**

In `package.json` scripts, next to `"api-docs"`, add:

```json
"api-docs:build": "bun run docs:openapi && vite build --config api-docs/vite.config.ts"
```

- [ ] **Step 3: Build and smoke-serve locally**

Run:

```bash
bun run api-docs:build
bun run api:build
# with dist/api-docs present:
PORT=8099 bun run dist/api.js &
sleep 1
curl -fsS http://127.0.0.1:8099/docs | head -c 200
curl -fsS http://127.0.0.1:8099/api/health
kill %1
```

Expected: `/docs` returns HTML mentioning Scalar/app; `/api/health` still JSON ok.

Note: local `bun api-docs` (dev server) should still work; if `base: '/docs/'` breaks the dev URL, open `http://localhost:6007/docs/` or set `base: process.env.NODE_ENV === 'production' ? '/docs/' : '/'` — prefer the conditional if the bare `http://localhost:6007/` breaks.

- [ ] **Step 4: Commit**

```bash
git add api-docs/vite.config.ts package.json
git commit -m "build: produce static api-docs under dist/api-docs"
```

---

### Task 4: Docker image includes api-docs

**Files:**
- Modify: `Dockerfile`

**Interfaces:**
- Image contains `/app/dist/api-docs/index.html` after build
- Staging/production api containers both get the files; Access is only configured on staging (prod `/docs` may exist but stay unadvertised / ungated until a future task)

- [ ] **Step 1: Add docs build step to Dockerfile**

After the `api` bundle `RUN` (the block that writes `dist/api.js`), add:

```dockerfile
RUN echo "api-docs bundle for ${GIT_SHA}" && \
  bun run api-docs:build
```

Place it where `node_modules` and source are already present (same stage as the api bundle). Ensure `vite` is available — it is a root dependency today via the api-docs tooling; if `bun run api-docs:build` fails in Docker because vite is missing from the installed set, use `bunx vite build --config api-docs/vite.config.ts` after `docs:openapi`, or confirm `bun install --ignore-scripts` still installs vite (it should from `package.json` dependencies/devDependencies — if Docker only has prod deps and vite is devDependency, move the build to use a stage that has full install, or add vite as a dependency). **Check:** if the current Docker `prod-deps` install is full `bun install`, vite is present; if a future change uses `--production`, keep docs build on a stage with devDependencies.

- [ ] **Step 2: Sanity-check build args locally (optional if slow)**

If you can build the image:

```bash
docker build --build-arg WEB_DIST_REQUIRED=false --build-arg GIT_SHA=docs-test -t mtd-web:docs-test .
docker run --rm mtd-web:docs-test test -f /app/dist/api-docs/index.html
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "build: include api-docs static assets in docker image"
```

---

### Task 5: Lasting docs + Cloudflare runbook

**Files:**
- Modify: `docs/staging.md`
- Modify: `.claude/skills/staging/SKILL.md` (keep identical to `docs/staging.md`)
- Modify: `docs/api-service.md`
- Modify: `.claude/skills/api-service/SKILL.md` (keep identical to `docs/api-service.md`)

- [ ] **Step 1: Document staging docs URL and Access**

In `docs/staging.md` (and the skill copy), add an **api docs** section (before **verify**) covering:

- URL: `https://staging-api.curatormtd.co.uk/docs`
- Access gates `/docs*` only (Google, `@curator.org.uk`); `/api/**` stays open for preview/TestFlight
- Manual Cloudflare steps: orange-cloud `staging-api`; Access application path `/docs*`; Google IdP + email domain policy; verify health/handshake with curl; verify `/docs` in a private window

Also update the staging DNS sentence that only mentions an A record: note the record should be **Proxied** once Access is enabled.

- [ ] **Step 2: Note /docs on the api service**

In `docs/api-service.md` (and skill), under **how it runs**, add one short paragraph:

```markdown
When `dist/api-docs/` is present (Docker image build runs `bun run api-docs:build`), the api also serves the Scalar OpenAPI UI at `/docs`. Staging protects that path with Cloudflare Access; see [staging](./staging.md).
```

- [ ] **Step 3: Commit**

```bash
git add docs/staging.md docs/api-service.md .claude/skills/staging/SKILL.md .claude/skills/api-service/SKILL.md
git commit -m "docs: staging api docs url and cloudflare access runbook"
```

---

### Task 6: Deploy staging + configure Access (manual checklist)

**Files:** none (ops)

- [ ] **Step 1: Deploy api to staging**

```bash
bun tko uncloud deploy-api --staging
```

Expected: deploy succeeds; `curl -fsS https://staging-api.curatormtd.co.uk/api/health` still works.

- [ ] **Step 2: Confirm docs are on origin (before or after orange-cloud)**

```bash
curl -sS -o /dev/null -w "%{http_code}" https://staging-api.curatormtd.co.uk/docs
```

Expected: `200` (or `302`/`401`/`302` once Access is on — not `404`).

- [ ] **Step 3: Orange-cloud + Access**

Follow the runbook in `docs/staging.md`. After Access is on:

| Check | Expected |
|---|---|
| `curl -fsS …/api/health` | 200 JSON |
| `curl -fsS …/api/v1/handshake -H "x-app-version: 0.0.0"` | 200 JSON |
| Browser `/docs` logged out | Access login |
| Browser `/docs` as `@curator.org.uk` | Scalar UI |
| Browser `/docs` as other Google account | Denied |

- [ ] **Step 4: No code commit** (ops only). If DNS/Access details need a doc tweak, amend Task 5 docs in a small follow-up commit.

---

## Self-review vs spec

| Spec requirement | Task |
|---|---|
| Serve Scalar at staging `/docs` | 1–4, 6 |
| Vite `base: '/docs/'` | 3 |
| Docker includes `dist/api-docs` | 4 |
| Access on `/docs*` only, Google `@curator.org.uk` | 5 runbook, 6 |
| `/api/**` ungated | 2, 5, 6 (verified) |
| Orange-cloud staging | 5, 6 |
| Local `bun api-docs` preserved | 3 (conditional base if needed) |
| No Access automation in deploy | 5–6 manual |
| Docs/skills updated | 5 |
