# Single-Version API Evolution Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "old apps never silently break" a managed, enforced process for a single evolving `/api/v1` contract — via (1) a CI guard that fails on breaking OpenAPI changes, (2) an app↔API version handshake that gently nudges or force-upgrades only when necessary, and (3) OTA wiring so most client fixes ship without an app-store release.

**Architecture:** Additive-only ("expand/contract") evolution of one contract. The committed `src/api/openapi-v1.json` snapshot is the source of truth; a TS comparator classifies each PR's regenerated spec as additive (allowed) or breaking (blocked). The already-built `handshake` endpoint + `classifyAppVersion` become live: the client sends `x-app-version`, reads `{ status }`, and renders a nudge (`deprecated`) or a blocking upgrade screen (`blocked`). The existing but unmounted `HotUpdaterSplash` is wired into the native root as the fast client-fix path.

**Tech Stack:** valibot + `@valibot/to-json-schema` (existing generator), a small in-repo JSON-Schema comparator (no new deps), `bun check` auto-discovered check scripts, TanStack Query (`queryKeys.handshake`), `expo-application`, `@mtd/native-hot-update` (`HotUpdaterSplash`), vitest.

## Global Constraints

- Never delete `bun.lock`. No new heavy deps — implement the comparator in-repo over the inlined JSON-Schema documents (the spec has no `$ref`).
- Depends on the **API Decoupling plan** having moved contract code to `~/contract` (`classifyAppVersion`, `COMPATIBILITY`, `API_CONTRACT_VERSION`, `handshakeResponseSchema`). If that move has not happened, substitute `~/constants/contract` + `~/api/schemas`.
- Canonical OpenAPI snapshot is `src/api/openapi-v1.json` (the root-level `openapi-v1.json` is orphaned — ignore/delete it in Task 2).
- Unit tests MUST live under `src/test/unit/**/*.test.ts(x)`; run with `bun run:dev vitest run -c ./src/test/vitest.config.ts <file>`.
- `bun check` runs every script in `scripts/check/` in parallel; a new `scripts/check/openapi.ts` is auto-included with no workflow edits.
- Use `console.info()`; few lowercase comments; `~` alias in `src/`; Conventional Commits, lowercase, one line, no co-author.

---

## File Structure

**New files:**
- `src/server/openapiDiff.ts` — `diffOpenapi(before, after): { breaking: string[]; additive: string[] }` (pure).
- `scripts/check/openapi.ts` — regenerate spec, fail on drift and on breaking changes vs the committed snapshot.
- `src/test/unit/openapiDiff.test.ts` — comparator tests.
- `src/features/api/client/useHandshake.ts` — query hook calling `/api/v1/handshake`.
- `src/interface/app/UpdateGate.tsx` — nudge/force-upgrade UI wrapper.
- `src/interface/app/UpdateGate.native.tsx` — native variant (store deep-link).
- `src/test/unit/handshakeGate.test.ts` — gate decision logic tests.

**Modified files:**
- `src/features/api/client/apiFetch.ts` — send `x-app-version`.
- `src/features/auth/client/authFetch.ts` — send `x-app-version` on auth calls (optional but consistent).
- `app/(app)/_layout.tsx` — mount `UpdateGate` (and `HotUpdaterSplash` on native).
- `src/features/api/client/queryKeys.ts` — (already has `handshake`; keep).
- root `openapi-v1.json` — delete (orphaned duplicate).

---

## Task 1: Send `x-app-version` from the client

**Files:**
- Modify: `src/features/api/client/apiFetch.ts`, `src/features/auth/client/authFetch.ts`
- Create: `src/features/api/client/appVersion.ts`

**Interfaces:**
- Produces: `getAppVersion(): string` — the native store version (`expo-application` `nativeApplicationVersion`) with `APP_VERSION` (from `~/constants/app`) as the web/dev fallback.

- [ ] **Step 1: Create the version accessor**

Create `src/features/api/client/appVersion.ts`:

```ts
import * as Application from 'expo-application'

import { APP_VERSION } from '~/constants/app'

export function getAppVersion(): string {
  return Application.nativeApplicationVersion || APP_VERSION
}
```

- [ ] **Step 2: Attach the header in `apiFetch`**

In `src/features/api/client/apiFetch.ts`, import `getAppVersion` and add `'x-app-version': getAppVersion()` to the headers object (alongside `content-type`):

```ts
import { getAppVersion } from './appVersion'
// ...
    headers: {
      'content-type': 'application/json',
      'x-app-version': getAppVersion(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
```

- [ ] **Step 3: Typecheck + lint**

Run: `bun tko check types && bun lint:fix`
Expected: no new errors. (`expo-application` is already a dep — used by the hot-updater.)

- [ ] **Step 4: Commit**

```bash
git add src/features/api/client/appVersion.ts src/features/api/client/apiFetch.ts src/features/auth/client/authFetch.ts
git commit -m "feat(api): send x-app-version header on client requests"
```

---

## Task 2: OpenAPI breaking-change comparator (CI guard)

**Files:**
- Create: `src/server/openapiDiff.ts`
- Test: `src/test/unit/openapiDiff.test.ts`
- Create: `scripts/check/openapi.ts`
- Delete: root `openapi-v1.json`

**Interfaces:**
- Produces: `diffOpenapi(before: OpenApiDoc, after: OpenApiDoc): { breaking: string[]; additive: string[] }`.
- `OpenApiDoc` shape (from the existing generator): `{ paths: Record<string, Record<string, Operation>> }`, `Operation = { parameters?: Param[]; requestBody?: { content: { 'application/json': { schema: JsonSchema } } }; responses: Record<string, { content?: { 'application/json': { schema: JsonSchema } } }> }`, `Param = { name: string; in: string; required?: boolean; schema: JsonSchema }`, `JsonSchema = { type?; properties?: Record<string, JsonSchema>; required?: string[]; enum?: unknown[]; anyOf?: JsonSchema[]; items?: JsonSchema }`.
- Breaking rules: removed path; removed method; removed response property; added request `required` property; request param flipped optional→required or a new required param; narrowed `type` (changed) or shrunk `enum`.
- Additive rules: new path/method; new optional property; new response property; widened enum.

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/openapiDiff.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { diffOpenapi } from '~/server/openapiDiff'

const base = {
  paths: {
    '/api/v1/x': {
      get: {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: { type: 'object', properties: { a: { type: 'string' }, b: { type: 'number' } }, required: ['a'] },
              },
            },
          },
        },
      },
      post: {
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
            },
          },
        },
        responses: { '200': { content: { 'application/json': { schema: { type: 'object', properties: {} } } } } },
      },
    },
  },
}

const clone = () => JSON.parse(JSON.stringify(base))

describe('diffOpenapi', () => {
  it('flags nothing for an identical spec', () => {
    const d = diffOpenapi(base, clone())
    expect(d.breaking).toEqual([])
    expect(d.additive).toEqual([])
  })

  it('additive: new optional response property', () => {
    const after = clone()
    after.paths['/api/v1/x'].get.responses['200'].content['application/json'].schema.properties.c = { type: 'boolean' }
    const d = diffOpenapi(base, after)
    expect(d.breaking).toEqual([])
    expect(d.additive.some((m) => m.includes('c'))).toBe(true)
  })

  it('breaking: removed response property', () => {
    const after = clone()
    delete after.paths['/api/v1/x'].get.responses['200'].content['application/json'].schema.properties.b
    const d = diffOpenapi(base, after)
    expect(d.breaking.some((m) => m.includes('b'))).toBe(true)
  })

  it('breaking: new required request property', () => {
    const after = clone()
    after.paths['/api/v1/x'].post.requestBody.content['application/json'].schema.properties.age = { type: 'number' }
    after.paths['/api/v1/x'].post.requestBody.content['application/json'].schema.required.push('age')
    const d = diffOpenapi(base, after)
    expect(d.breaking.some((m) => m.includes('age'))).toBe(true)
  })

  it('breaking: removed method', () => {
    const after = clone()
    delete after.paths['/api/v1/x'].post
    const d = diffOpenapi(base, after)
    expect(d.breaking.some((m) => m.includes('post'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/openapiDiff.test.ts`
Expected: FAIL — `~/server/openapiDiff` does not exist.

- [ ] **Step 3: Implement the comparator**

Create `src/server/openapiDiff.ts`:

```ts
type JsonSchema = {
  type?: string | string[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  enum?: unknown[]
  anyOf?: JsonSchema[]
  items?: JsonSchema
}
type Body = { content?: { 'application/json'?: { schema?: JsonSchema } } }
type Param = { name: string; in: string; required?: boolean; schema?: JsonSchema }
type Operation = { parameters?: Param[]; requestBody?: Body; responses?: Record<string, Body> }
export type OpenApiDoc = { paths?: Record<string, Record<string, Operation>> }

type Acc = { breaking: string[]; additive: string[] }

function diffResponseSchema(loc: string, before: JsonSchema | undefined, after: JsonSchema | undefined, acc: Acc) {
  const b = before?.properties ?? {}
  const a = after?.properties ?? {}
  for (const key of Object.keys(b)) {
    if (!(key in a)) acc.breaking.push(`${loc}: removed response field '${key}'`)
  }
  for (const key of Object.keys(a)) {
    if (!(key in b)) acc.additive.push(`${loc}: added response field '${key}'`)
  }
}

function diffRequestSchema(loc: string, before: JsonSchema | undefined, after: JsonSchema | undefined, acc: Acc) {
  const bReq = new Set(before?.required ?? [])
  const aReq = new Set(after?.required ?? [])
  const bProps = before?.properties ?? {}
  const aProps = after?.properties ?? {}
  for (const key of Object.keys(aProps)) {
    if (aReq.has(key) && !bReq.has(key)) {
      acc.breaking.push(`${loc}: request field '${key}' became required`)
    } else if (!(key in bProps)) {
      acc.additive.push(`${loc}: added optional request field '${key}'`)
    }
  }
  for (const key of Object.keys(bProps)) {
    if (!(key in aProps) && bReq.has(key)) {
      // removing a required request field is tolerant on the server, so additive
      acc.additive.push(`${loc}: removed request field '${key}'`)
    }
  }
}

function diffOperation(loc: string, before: Operation, after: Operation, acc: Acc) {
  diffRequestSchema(
    `${loc} request`,
    before.requestBody?.content?.['application/json']?.schema,
    after.requestBody?.content?.['application/json']?.schema,
    acc,
  )
  for (const code of Object.keys(before.responses ?? {})) {
    diffResponseSchema(
      `${loc} ${code}`,
      before.responses?.[code]?.content?.['application/json']?.schema,
      after.responses?.[code]?.content?.['application/json']?.schema,
      acc,
    )
  }
  const bParams = new Map((before.parameters ?? []).map((p) => [`${p.in}:${p.name}`, p]))
  const aParams = new Map((after.parameters ?? []).map((p) => [`${p.in}:${p.name}`, p]))
  for (const [k, p] of aParams) {
    const prev = bParams.get(k)
    if (!prev && p.required) acc.breaking.push(`${loc}: new required param '${p.name}'`)
    else if (prev && p.required && !prev.required) acc.breaking.push(`${loc}: param '${p.name}' became required`)
  }
}

export function diffOpenapi(before: OpenApiDoc, after: OpenApiDoc): Acc {
  const acc: Acc = { breaking: [], additive: [] }
  const bPaths = before.paths ?? {}
  const aPaths = after.paths ?? {}
  for (const path of Object.keys(bPaths)) {
    if (!(path in aPaths)) {
      acc.breaking.push(`removed path '${path}'`)
      continue
    }
    for (const method of Object.keys(bPaths[path])) {
      if (!(method in aPaths[path])) {
        acc.breaking.push(`removed method '${method} ${path}'`)
        continue
      }
      diffOperation(`${method.toUpperCase()} ${path}`, bPaths[path][method], aPaths[path][method], acc)
    }
  }
  for (const path of Object.keys(aPaths)) {
    if (!(path in bPaths)) {
      acc.additive.push(`added path '${path}'`)
      continue
    }
    for (const method of Object.keys(aPaths[path])) {
      if (!(method in bPaths[path])) acc.additive.push(`added method '${method} ${path}'`)
    }
  }
  return acc
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/openapiDiff.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the check script**

Create `scripts/check/openapi.ts`:

```ts
#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { diffOpenapi, type OpenApiDoc } from '~/server/openapiDiff'

const ROOT = resolve(import.meta.dir, '../..')
const SNAPSHOT = join(ROOT, 'src/api/openapi-v1.json')

const committed = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as OpenApiDoc

// regenerate into the snapshot path, then compare against the committed copy
await import('../docs/gen-openapi.ts')
const regenerated = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as OpenApiDoc

const { breaking, additive } = diffOpenapi(committed, regenerated)

if (breaking.length > 0) {
  console.error('[check] BREAKING api contract changes detected:')
  for (const m of breaking) console.error(`  - ${m}`)
  console.error(
    '\nadditive-only evolution is required. if this break is intentional, follow the sunset path:',
  )
  console.error('  1. keep the old shape populated (expand/contract), OR')
  console.error('  2. bump COMPATIBILITY.minSupportedAppVersion in src/contract/version.ts')
  console.error('     and acknowledge by updating the committed src/api/openapi-v1.json.')
  // restore the committed snapshot so the working tree is not left dirty by the check
  writeFileSync(SNAPSHOT, JSON.stringify(committed, null, 2) + '\n')
  process.exit(1)
}

// if only additive drift and the file changed, require it to be committed
const regenText = readFileSync(SNAPSHOT, 'utf8')
const committedText = JSON.stringify(committed, null, 2) + '\n'
if (regenText.trim() !== committedText.trim()) {
  console.error('[check] openapi snapshot is stale. run `bun run docs:openapi` and commit src/api/openapi-v1.json.')
  process.exit(1)
}

console.info(`[check] openapi contract ok (${additive.length} additive change(s))`)
```

- [ ] **Step 6: Delete the orphaned root snapshot**

Run: `git rm openapi-v1.json`
(Only `src/api/openapi-v1.json` is canonical; the root copy is unused.)

- [ ] **Step 7: Run the whole check gate**

Run: `bun check`
Expected: PASS including `[check] openapi contract ok`.

- [ ] **Step 8: Commit**

```bash
git add src/server/openapiDiff.ts src/test/unit/openapiDiff.test.ts scripts/check/openapi.ts
git commit -m "feat(ci): fail on breaking openapi contract changes"
```

---

## Task 3: Handshake hook + update-gate decision logic

**Files:**
- Create: `src/features/api/client/useHandshake.ts`, `src/features/api/client/updateGateDecision.ts`
- Test: `src/test/unit/handshakeGate.test.ts`

**Interfaces:**
- Produces:
  - `useHandshake(): { data?: HandshakeResult; isLoading: boolean }` — TanStack Query hook GETting `/api/v1/handshake` (via `apiFetch`), keyed by `queryKeys.handshake`.
  - `HandshakeResult = { status: HandshakeStatus; apiContract: number; minSupportedAppVersion: string; currentAppVersion: string }` (matches `handshakeResponseSchema`).
  - `decideGate(status: HandshakeStatus): 'allow' | 'nudge' | 'block'` — pure mapping (`ok`→allow, `deprecated`→nudge, `blocked`→block).

- [ ] **Step 1: Write the failing test**

Create `src/test/unit/handshakeGate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { decideGate } from '~/features/api/client/updateGateDecision'

describe('decideGate', () => {
  it('allows an ok status', () => expect(decideGate('ok')).toBe('allow'))
  it('nudges a deprecated status', () => expect(decideGate('deprecated')).toBe('nudge'))
  it('blocks a blocked status', () => expect(decideGate('blocked')).toBe('block'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/handshakeGate.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the decision + hook**

Create `src/features/api/client/updateGateDecision.ts`:

```ts
import type { HandshakeStatus } from '~/contract'

export type GateAction = 'allow' | 'nudge' | 'block'

export function decideGate(status: HandshakeStatus): GateAction {
  if (status === 'blocked') return 'block'
  if (status === 'deprecated') return 'nudge'
  return 'allow'
}
```

Create `src/features/api/client/useHandshake.ts`:

```ts
import { useQuery } from '@tanstack/react-query'

import { apiFetch } from './apiFetch'
import { queryKeys } from './queryKeys'

import type { HandshakeStatus } from '~/contract'

export type HandshakeResult = {
  status: HandshakeStatus
  apiContract: number
  minSupportedAppVersion: string
  currentAppVersion: string
}

export function useHandshake() {
  return useQuery({
    queryKey: queryKeys.handshake,
    queryFn: () => apiFetch<HandshakeResult>('/api/v1/handshake'),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
```

(Confirm the TanStack Query import path matches existing hooks, e.g. `useNotifications.ts`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/handshakeGate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint + typecheck**

Run: `bun tko check types && bun lint:fix`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/api/client/useHandshake.ts src/features/api/client/updateGateDecision.ts src/test/unit/handshakeGate.test.ts
git commit -m "feat(api): add version handshake hook and gate decision"
```

---

## Task 4: Update-gate UI + wire into the native root (with OTA)

**Files:**
- Create: `src/interface/app/UpdateGate.tsx` (web/no-op passthrough), `src/interface/app/UpdateGate.native.tsx`
- Modify: `app/(app)/_layout.tsx`

**Interfaces:**
- Consumes: `useHandshake`, `decideGate`; on native, `Linking`/store URL for the upgrade CTA.
- Produces: `<UpdateGate>{children}</UpdateGate>` — renders children when `allow`; a dismissible banner when `nudge`; a full blocking screen with an "Update" CTA when `block`.

- [ ] **Step 1: Web passthrough**

Create `src/interface/app/UpdateGate.tsx`:

```tsx
export function UpdateGate({ children }: { children: React.ReactNode }) {
  // web is always served the latest bundle; no store gate needed
  return <>{children}</>
}
```

- [ ] **Step 2: Native gate**

Create `src/interface/app/UpdateGate.native.tsx`:

```tsx
import { useState } from 'react'
import { Linking } from 'react-native'
import { Button, SizableText, YStack } from 'tamagui'

import { decideGate } from '~/features/api/client/updateGateDecision'
import { useHandshake } from '~/features/api/client/useHandshake'

const STORE_URL = 'https://apps.apple.com/app/id0000000000' // replace with the real App Store id

export function UpdateGate({ children }: { children: React.ReactNode }) {
  const { data } = useHandshake()
  const [dismissed, setDismissed] = useState(false)
  const action = data ? decideGate(data.status) : 'allow'

  if (action === 'block') {
    return (
      <YStack f={1} ai="center" jc="center" gap="$4" p="$6">
        <SizableText size="$8">Update required</SizableText>
        <SizableText ta="center" theme="alt2">
          This version of the app is no longer supported. Please update to continue.
        </SizableText>
        <Button onPress={() => Linking.openURL(STORE_URL)}>Update now</Button>
      </YStack>
    )
  }

  return (
    <>
      {action === 'nudge' && !dismissed && (
        <YStack bg="$backgroundStrong" p="$3" ai="center" gap="$2">
          <SizableText>A new version is available.</SizableText>
          <Button size="$2" onPress={() => Linking.openURL(STORE_URL)}>Update</Button>
          <Button size="$2" chromeless onPress={() => setDismissed(true)}>Later</Button>
        </YStack>
      )}
      {children}
    </>
  )
}
```

(Match tamagui component imports/tokens to the codebase conventions — see the `mtd-tamagui` skill. Replace `STORE_URL` with the real store link.)

- [ ] **Step 3: Mount the gate (and OTA splash) in the app layout**

In `app/(app)/_layout.tsx`, wrap the provider tree with `UpdateGate`, and on native also mount the existing `HotUpdaterSplash` (currently defined but unmounted). Import both and wrap around the existing `ProvideQuery`/content, e.g.:

```tsx
import { HotUpdaterSplash } from '~/features/hot-updater/HotUpdaterSplash'
import { UpdateGate } from '~/interface/app/UpdateGate'
// ...
return (
  <HotUpdaterSplash>
    <ProvideQuery>
      <UpdateGate>
        {/* existing children */}
      </UpdateGate>
    </ProvideQuery>
  </HotUpdaterSplash>
)
```

Note: `HotUpdaterSplash` has a web no-op variant, and `UpdateGate` has a web passthrough, so this is safe on both platforms. `UpdateGate` must be INSIDE `ProvideQuery` (it uses a query); `HotUpdaterSplash` wraps outside.

- [ ] **Step 4: Typecheck + lint + unit tests**

Run: `bun tko check types && bun lint:fix && bun run:dev vitest run -c ./src/test/vitest.config.ts src/test/unit/handshakeGate.test.ts`
Expected: all green.

- [ ] **Step 5: Manual native smoke (optional, recommended)**

Temporarily set `COMPATIBILITY.minSupportedAppVersion` in `src/contract/version.ts` above the app's version, run the app against a local/staging API, and confirm the blocking screen appears; then revert.

- [ ] **Step 6: Commit**

```bash
git add src/interface/app/UpdateGate.tsx src/interface/app/UpdateGate.native.tsx app/(app)/_layout.tsx
git commit -m "feat(app): gate old app versions and wire ota splash"
```

---

## Task 5: Document the evolution process

**Files:**
- Modify: `docs/api-service.md` (created in the decoupling plan) — add a "Versioning & compatibility" section.

- [ ] **Step 1: Write the process doc**

Document the additive-only rule, the expand/contract migration recipe (add new field → migrate clients → remove old only when telemetry shows zero use), how the CI guard classifies breaking vs additive, when/how to bump `COMPATIBILITY.minSupportedAppVersion` (and that doing so force-upgrades old apps via the handshake), the `deprecatedBelow` nudge window, and that OTA (`HotUpdaterSplash`) is the fast path for client-side fixes that don't need a store release.

- [ ] **Step 2: Commit**

```bash
git add docs/api-service.md
git commit -m "docs: document additive-only api evolution process"
```

---

## Risks & Notes

- **Comparator scope:** the diff covers path/method/property/required/param changes — the common breakages. Type-narrowing and enum-shrinking are noted as future extensions; add them if a real break slips through. It intentionally treats *removing* a request field as additive (tolerant server) and *adding a required* one as breaking.
- **`minSupportedAppVersion` currently `0.0.0`:** nothing is ever blocked until you raise it. That is the correct default — the machinery is dormant until you deliberately sunset a version.
- **Store URL:** `UpdateGate.native.tsx` needs the real App Store / Play id before shipping the block screen.
- **Handshake failure:** the hook `retry: 1` and gate defaults to `allow` when `data` is undefined, so an API blip never locks users out.
- **App version source:** `getAppVersion()` prefers the native store version; the handshake compares against `minSupportedAppVersion`, so keep `package.json` version and the native build version in step (the release scripts already drive both).

## Self-Review

- Spec coverage: CI breaking-change guard (Task 2), handshake wiring + `x-app-version` (Tasks 1, 3), nudge/force-upgrade UI (Task 4), OTA wiring (Task 4.3), process docs (Task 5). All three sub-goals covered.
- Placeholder scan: full code in all code steps; the only user-supplied value is the store URL (explicitly flagged).
- Type consistency: `HandshakeResult`/`HandshakeStatus`/`decideGate` consistent across Tasks 3–4; `diffOpenapi`/`OpenApiDoc` consistent across Task 2 and `scripts/check/openapi.ts`.
