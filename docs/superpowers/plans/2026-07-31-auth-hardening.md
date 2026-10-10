# Auth Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock real production against demo-auth misconfig, stop secret logging, remove unused magic/phone auth, and deny better-auth `/admin/*` while keeping email OTP and app-level admin.

**Architecture:** Shared helpers detect staging vs real prod hosts; deploy + boot asserts reject demo flags on prod; `isDemoAuthAllowed` refuses demo on real prod; `apiHandler` always 403s `/api/auth/admin`; plugins trimmed to email OTP (+ admin plugin for role schema only).

**Tech Stack:** better-auth, Bun, Vitest, existing uncloud deploy asserts.

## Global Constraints

- Allow `ALLOW_PUBLIC_AUTH` on production; forbid `ALLOW_DEMO_AUTH` / `VITE_DEMO_MODE` on real prod only.
- Staging = production mode + `staging-api.` in `BETTER_AUTH_URL` or `API_SERVER_URL`.
- Impersonation deferred (route deny); re-enableable later per spec.
- No password auth (already removed).
- Prefer `console.info`; lowercase comments if any.

---

### Task 1: Prod/staging host + demo-flag helpers (+ unit tests)

**Files:**
- Create: `src/features/auth/server/isStagingApiHost.ts`
- Create: `src/features/auth/server/isRealProductionRuntime.ts`
- Create: `src/features/auth/server/assertDemoAuthFlagsSafe.ts` (pure: takes flag values + whether real prod)
- Modify: `src/features/auth/server/isDemoAuthAllowed.ts`
- Create: `src/test/unit/authDemoGuards.test.ts`

**Interfaces:**
- Produces: `isStagingApiHost(urls: { betterAuthUrl: string; apiServerUrl: string }): boolean`
- Produces: `isRealProductionRuntime(opts: { nodeEnv: string | undefined; betterAuthUrl: string; apiServerUrl: string }): boolean`
- Produces: `assertDemoAuthFlagsSafe(opts: { isRealProduction: boolean; allowDemoAuth: string; viteDemoMode: string }): void` — throws if real prod and either flag truthy (`1`/`true`)
- Produces: `isDemoAuthAllowed()` — `ALLOW_DEMO_AUTH === '1'` **and** not real production runtime

- [x] **Step 1:** Write unit tests for host detection + assert matrix + `isDemoAuthAllowed` behavior (mock env via pure helpers where possible)
- [x] **Step 2:** Implement helpers; wire `isDemoAuthAllowed` through them
- [x] **Step 3:** `bun test:unit -- src/test/unit/authDemoGuards.test.ts`

---

### Task 2: Deploy + boot asserts

**Files:**
- Create: `scripts/uncloud/helpers/assert-prod-auth-flags.ts`
- Create: `scripts/uncloud/helpers/assert-prod-auth-flags.test.ts`
- Modify: `scripts/uncloud/deploy-api.ts` — after `assertDeployEnv`, if `target === 'production'` call assert
- Modify: `scripts/uncloud/deploy-web.ts` — same
- Modify: `src/server/api-entry.ts` — call runtime assert before `Bun.serve`

- [x] **Step 1:** Unit-test deploy helper reading process.env shape
- [x] **Step 2:** Wire deploy-api / deploy-web
- [x] **Step 3:** Wire api-entry boot check using `server.*` + `assertDemoAuthFlagsSafe` + `isRealProductionRuntime`

---

### Task 3: Deny `/api/auth/admin/*` + stop OTP plaintext in production mode

**Files:**
- Modify: `src/features/auth/server/apiHandler.ts`
- Modify: `src/features/auth/server/authServer.ts` — logging; leave `admin()` plugin; remove magic/phone in Task 4
- Update: `docs/data-isolation.md` admin section

- [x] **Step 1:** In `apiHandler`, before other gates, if pathname includes `/api/auth/admin` → 403 JSON
- [x] **Step 2:** OTP send: production mode logs “OTP issued for {email}” without code; dev keeps plaintext
- [x] **Step 3:** Fix data-isolation docs (route deny, not duration 0)

---

### Task 4: Remove magic-link + phone

**Files:**
- Modify: `src/features/auth/server/authServer.ts`
- Modify: `src/features/auth/client/plugins.ts` — drop magic/phone/adminClient
- Modify: `src/features/auth/client/otpLogin.ts` — email only
- Modify: `src/features/auth/client/pendingOtpChallenge.ts`
- Modify: `app/(app)/auth/signup/otp.tsx` if needed
- Grep OpenAPI for magic/phone and scrub if present

- [x] **Step 1:** Remove server plugins
- [x] **Step 2:** Remove client plugins + dead phone branches
- [x] **Step 3:** Grep for leftovers; fix types

---

### Task 5: Docs / env examples + verify

**Files:**
- Modify: `.env.production.example`
- Modify: `docs/staging.md`, `docs/architecture.md` as needed
- Modify: `.claude/skills` via symlinks if they point at same docs

- [x] **Step 1:** Document prod hard-fail for demo flags
- [x] **Step 2:** `bun test:unit -- src/test/unit/authDemoGuards.test.ts scripts/uncloud/helpers/assert-prod-auth-flags.test.ts`
- [x] **Step 3:** Confirm no plaintext OTP path in prod-mode code path; admin path returns 403

---

## Done when

Success criteria from `docs/superpowers/specs/2026-07-31-auth-hardening-design.md` are met.
