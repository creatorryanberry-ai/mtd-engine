# Straight Up Tax Domain Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the live `curatormtd.co.uk` / `curatormtd` infra identity with `straightup.tax` / `straightuptax` so deploys, native builds, auth, email, and operator docs no longer point at the old domain.

**Architecture:** One coordinated rename of canonical constants (`DOMAIN`, `APP_NAME`, `APP_SCHEME`), native bundle IDs, env defaults, OpenAPI servers, operator docs, and tests. Historical `docs/superpowers/plans` and `specs` stay as written. Live GCS copy-and-flip, Postgres `ALTER DATABASE`, DNS, Postmark MX, and store listings are operator steps after the repo change — not new automation.

**Tech Stack:** TypeScript, Expo `app.config.ts`, vitest, Playwright/Maestro flows, Uncloud Caddy/compose, OpenAPI spec generator (`bun run docs:openapi`), `bun env:update`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-08-straightup-tax-domain-rename-design.md`
- Product name is exactly `Straight Up Tax`
- Apex domain is exactly `straightup.tax`
- Hosts: `api.straightup.tax`, `staging-api.straightup.tax`, `app.straightup.tax`
- Inbound mail domain is exactly `inbox.straightup.tax`
- From-address examples use `hello@straightup.tax`
- Twitter is `https://x.com/straightuptax`
- Bundle IDs: `tax.straightup.dev` / `tax.straightup.preview` / `tax.straightup.app`
- App Groups: `group.tax.straightup.*`
- Scheme / slug / package name / Expo owner / `APP_NAME_LOWERCASE`: `straightuptax`
- Xcode stems: `StraightUpTax` / `StraightUpTaxPreview` / `StraightUpTaxDev`
- GCS examples: `straightuptax-receipts` / `straightuptax-receipts-staging`
- Postgres example and live database name: `straightuptax`
- Do not rewrite historical `docs/superpowers/plans` or `specs`
- Do not rename `@mtd/*` packages, the git repo folder, or GitHub `curator-org-uk/mtd`
- Do not rename GCP service account emails
- Do not commit real `.env.staging` / `.env.production` secrets
- When editing `.env.staging.example`, replace live credentials with placeholders
- Prefer `console.info()`; few lowercase comments; Conventional Commits lowercase one-line, no co-author

---

## File Structure

**Modify (canonical identity):**
- `src/constants/app.ts` — `APP_NAME`, `APP_NAME_LOWERCASE`, `DOMAIN`, constructed URLs, `TWITTER_URL`
- `src/features/auth/constants.ts` — `APP_SCHEME`
- `package.json` — `"name"` and `"description"`
- `app.config.ts` — display name source, slug, owner, scheme, bundle IDs

**Modify (native release):**
- `scripts/release/helpers/env.ts` — `BUNDLE_IDS`
- `scripts/release/helpers/android-autolinking.ts` — package IDs, Xcode stems, java path
- `react-native.config.cjs` — Android packageName map
- `scripts/run-native.ts` — `exp+straightuptax://` deep link
- `scripts/android/setup-release.ts` — example package IDs in prompts
- `flows/OpenApp.yaml`, `flows/Login.yaml`, `flows/Navigation.yaml`, `flows/WarmUp.yaml` — `appId` and visible name

**Modify (hosts / env / api):**
- `src/env.ts` — HMRC native redirect, Postmark from, inbound domain, comments
- `.env.production.example`, `.env.staging.example`
- `src/uncloud/Caddyfile`, `src/uncloud/docker-compose.yml`
- `src/api/openapi/info.ts`, `src/api/openapi/buildSpec.ts`, then regenerate `src/api/openapi.json`
- `src/features/hmrc/server/config.ts` — native redirect fallback
- `src/server/api-entry.ts` — comment
- `scripts/sst/helpers/deploy.ts` — fallback URL
- `app/(app)/home/(tabs)/settings/index.tsx` — staging hostname check
- `packages/cli/src/utils/env-categories.ts` — placeholders
- `public/robots.txt` — sitemap host

**Modify (product strings):**
- `src/interface/app/Logo.tsx`, `src/interface/splash/splash.tsx`, `src/interface/app/LogoIcon.tsx`
- `src/features/hmrc/server/fraudHeaders.ts`, `src/features/hmrc/components/HmrcConnectSection.tsx`
- `api-docs/index.html`, `public/favicon.svg`
- CLI/README strings that say CuratorMTD as the product (not `@mtd/*`)

**Modify (tests):**
- `src/test/unit/writeEpochStorage.test.ts`
- `src/test/unit/resolveApiBaseUrl.test.ts`
- `src/test/unit/resolveBundleServerEnv.test.ts`
- `src/test/unit/authDemoGuards.test.ts`
- `src/test/unit/apiRouter.test.ts`
- `src/test/unit/serveApiDocs.test.ts`
- `src/test/unit/serveApiDocsLogin.test.ts`
- `src/test/unit/uploadStorage.test.ts`
- `scripts/uncloud/helpers/assert-staging-db-isolated.test.ts`

**Modify (operator docs / skills):**
- `docs/deploy.md`, `docs/deploy-uncloud.md`, `docs/staging.md`, `docs/api-service.md`, `docs/architecture.md`, `docs/native-release.md`, `docs/email-receipt-capture.md`, `docs/data-isolation.md`, `README.md`

**Create:**
- `scripts/release/helpers/native-identity.test.ts` — bundle ID / Xcode stem mapping

**Do not touch:**
- `docs/superpowers/plans/2026-07-*` and older specs
- `@mtd/*` package names
- GCP service account JSON emails

---

### Task 1: Canonical constants and scheme

**Files:**
- Modify: `src/constants/app.ts`
- Modify: `src/features/auth/constants.ts`
- Modify: `src/test/unit/writeEpochStorage.test.ts`
- Modify: `package.json` (`name`, `description` only)

**Interfaces:**
- Produces: `APP_NAME = 'Straight Up Tax'`, `APP_NAME_LOWERCASE = 'straightuptax'`, `DOMAIN = 'straightup.tax'`, `TWITTER_URL = 'https://x.com/straightuptax'`, `APP_SCHEME = 'straightuptax'`
- Consumes: nothing from later tasks. Auth storage already prefixes keys as `` `${APP_SCHEME}_cookie` ``.

- [ ] **Step 1: Write the failing test**

In `src/test/unit/writeEpochStorage.test.ts`, replace every `'curatormtd_cookie'` with `'straightuptax_cookie'` (six occurrences). The storage helper is scheme-agnostic; this locks the key the native auth client will use after `APP_SCHEME` changes.

- [ ] **Step 2: Run the test**

Run: `bun test:unit src/test/unit/writeEpochStorage.test.ts`

Expected: PASS (the helper does not read `APP_SCHEME`; this is the new contract for later auth-storage keys).

- [ ] **Step 3: Update constants**

`src/constants/app.ts`:

```ts
export const APP_NAME = 'Straight Up Tax'
export const APP_NAME_LOWERCASE = 'straightuptax'
export const APP_VERSION = packageJson.version

export const DOMAIN = 'straightup.tax'
```

Keep the existing URL constructors (`HELP_*`, legal paths, `ADMIN_EMAIL`, `DEMO_EMAIL`). Change only:

```ts
export const TWITTER_URL = 'https://x.com/straightuptax'
```

`src/features/auth/constants.ts`:

```ts
export const APP_SCHEME = 'straightuptax'
```

`package.json`:

```json
"name": "straightuptax",
"description": "Straight Up Tax",
```

- [ ] **Step 4: Install so bun.lock matches the package name**

Run: `bun install`

Expected: `bun.lock` workspaces name `straightuptax` (not `curatormtd`). Do not delete `bun.lock`.

- [ ] **Step 5: Commit**

```bash
git add src/constants/app.ts src/features/auth/constants.ts src/test/unit/writeEpochStorage.test.ts package.json bun.lock
git commit -m "feat: rename app identity constants to straightuptax"
```

---

### Task 2: Native bundle IDs and Xcode stems

**Files:**
- Create: `scripts/release/helpers/native-identity.test.ts`
- Modify: `scripts/release/helpers/env.ts`
- Modify: `scripts/release/helpers/android-autolinking.ts`
- Modify: `app.config.ts`
- Modify: `react-native.config.cjs`
- Modify: `scripts/run-native.ts`
- Modify: `scripts/android/setup-release.ts`

**Interfaces:**
- Consumes: `APP_SCHEME` / slug `straightuptax` from Task 1
- Produces:
  - `BUNDLE_IDS.preview = { ios: 'tax.straightup.preview', android: 'tax.straightup.preview' }`
  - `BUNDLE_IDS.production = { ios: 'tax.straightup.app', android: 'tax.straightup.app' }`
  - `androidPackageId('development' | 'preview' | 'production')` → `tax.straightup.dev` / `.preview` / `.app`
  - `iosLiveActivityDirName` → `StraightUpTaxDevLiveActivity` / `StraightUpTaxPreviewLiveActivity` / `StraightUpTaxLiveActivity`
  - `readIosProjectBundleId` looks for `StraightUpTax*.xcodeproj`
  - `removeStaleAndroidVariantSources` walks `android/app/src/main/java/tax/straightup`

- [ ] **Step 1: Write the failing test**

Create `scripts/release/helpers/native-identity.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  androidPackageId,
  iosLiveActivityDirName,
} from './android-autolinking'
import { BUNDLE_IDS } from './env'

describe('native identity', () => {
  it('maps variants to reverse-dns bundle ids', () => {
    expect(androidPackageId('development')).toBe('tax.straightup.dev')
    expect(androidPackageId('preview')).toBe('tax.straightup.preview')
    expect(androidPackageId('production')).toBe('tax.straightup.app')
    expect(BUNDLE_IDS.preview.ios).toBe('tax.straightup.preview')
    expect(BUNDLE_IDS.production.android).toBe('tax.straightup.app')
  })

  it('maps live activity directory stems', () => {
    expect(iosLiveActivityDirName('development')).toBe('StraightUpTaxDevLiveActivity')
    expect(iosLiveActivityDirName('preview')).toBe('StraightUpTaxPreviewLiveActivity')
    expect(iosLiveActivityDirName('production')).toBe('StraightUpTaxLiveActivity')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test:unit scripts/release/helpers/native-identity.test.ts`

Expected: FAIL — received `uk.co.curatormtd.*` / `CuratorMTD*LiveActivity`.

- [ ] **Step 3: Implement native identity**

`scripts/release/helpers/env.ts` — replace `BUNDLE_IDS` with:

```ts
export const BUNDLE_IDS = {
  preview: {
    ios: 'tax.straightup.preview',
    android: 'tax.straightup.preview',
  },
  production: {
    ios: 'tax.straightup.app',
    android: 'tax.straightup.app',
  },
} as const
```

`scripts/release/helpers/android-autolinking.ts` — replace the identity functions and the stale-java path:

```ts
export function androidPackageId(variant = process.env.APP_VARIANT || 'development') {
  if (variant === 'preview') return 'tax.straightup.preview'
  if (variant === 'production') return 'tax.straightup.app'
  return 'tax.straightup.dev'
}

export function readIosProjectBundleId(cwd: string): string | null {
  const iosDir = join(cwd, 'ios')
  if (!existsSync(iosDir)) return null
  const project = readdirSync(iosDir).find(
    (name) => name.endsWith('.xcodeproj') && name.startsWith('StraightUpTax'),
  )
  if (!project) return null
  const stem = project.slice(0, -'.xcodeproj'.length)
  if (stem === 'StraightUpTaxPreview') return 'tax.straightup.preview'
  if (stem === 'StraightUpTaxDev') return 'tax.straightup.dev'
  if (stem === 'StraightUpTax') return 'tax.straightup.app'
  return null
}

export function iosLiveActivityDirName(
  variant = process.env.APP_VARIANT || 'development',
) {
  if (variant === 'preview') return 'StraightUpTaxPreviewLiveActivity'
  if (variant === 'production') return 'StraightUpTaxLiveActivity'
  return 'StraightUpTaxDevLiveActivity'
}
```

In `removeStaleAndroidVariantSources`, change:

```ts
const javaRoot = join(cwd, 'android/app/src/main/java/tax/straightup')
```

Update the comment that mentions `uk.co.curatormtd.preview` / `com.curatormtdpreview` to `tax.straightup.preview` / a sanitized display-name fallback.

`app.config.ts`:

```ts
const appName = 'Straight Up Tax'
const appId = 'straightuptax'
```

```ts
const getBundleId = () => {
  if (APP_VARIANT === 'development') {
    return 'tax.straightup.dev'
  } else if (APP_VARIANT === 'preview') {
    return 'tax.straightup.preview'
  }
  return 'tax.straightup.app'
}
```

```ts
    slug: 'straightuptax',
    owner: 'straightuptax',
    scheme: appId,
```

`react-native.config.cjs`:

```js
const androidPackageByVariant = {
  development: 'tax.straightup.dev',
  preview: 'tax.straightup.preview',
  production: 'tax.straightup.app',
}
```

Update the comment that mentions `com.curatormtdpreview`.

`scripts/run-native.ts` — change the deep link and the comment about the shared scheme:

```ts
  return `exp+straightuptax://expo-development-client/?url=${encodeURIComponent(url)}`
```

`scripts/android/setup-release.ts` — change the two description strings to `tax.straightup.preview` and `tax.straightup.app`.

- [ ] **Step 4: Run the test**

Run: `bun test:unit scripts/release/helpers/native-identity.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/release/helpers/native-identity.test.ts scripts/release/helpers/env.ts scripts/release/helpers/android-autolinking.ts app.config.ts react-native.config.cjs scripts/run-native.ts scripts/android/setup-release.ts
git commit -m "feat: switch native bundle ids to tax.straightup"
```

---

### Task 3: Hosts, mail, and env defaults

**Files:**
- Modify: `src/test/unit/resolveApiBaseUrl.test.ts`
- Modify: `src/test/unit/resolveBundleServerEnv.test.ts`
- Modify: `src/test/unit/authDemoGuards.test.ts`
- Modify: `src/test/unit/apiRouter.test.ts`
- Modify: `src/test/unit/serveApiDocs.test.ts`
- Modify: `src/test/unit/serveApiDocsLogin.test.ts`
- Modify: `src/test/unit/uploadStorage.test.ts`
- Modify: `scripts/uncloud/helpers/assert-staging-db-isolated.test.ts`
- Modify: `src/env.ts`
- Modify: `src/api/openapi/info.ts`
- Modify: `src/features/hmrc/server/config.ts`
- Modify: `src/uncloud/Caddyfile`
- Modify: `src/uncloud/docker-compose.yml`
- Modify: `.env.production.example`
- Modify: `.env.staging.example`
- Modify: `scripts/sst/helpers/deploy.ts`
- Modify: `app/(app)/home/(tabs)/settings/index.tsx`
- Modify: `packages/cli/src/utils/env-categories.ts`
- Modify: `src/server/api-entry.ts` (comment only)
- Modify: `public/robots.txt`

**Interfaces:**
- Consumes: `DOMAIN` from Task 1
- Produces: all committed defaults and fixture hosts use `*.straightup.tax`, inbound `inbox.straightup.tax`, scheme fallback `straightuptax://hmrc/callback`, buckets `straightuptax-receipts(-staging)`, database path `/straightuptax`

- [ ] **Step 1: Point unit fixtures at the new hosts**

Exact string replacements in the listed test files (do not edit historical plans):

| From | To |
|---|---|
| `staging-api.curatormtd.co.uk` | `staging-api.straightup.tax` |
| `api.curatormtd.co.uk` | `api.straightup.tax` |
| `app.curatormtd.co.uk` | `app.straightup.tax` |
| `curatormtd-receipts-staging` | `straightuptax-receipts-staging` |
| `/curatormtd?` | `/straightuptax?` |
| `/curatormtd_staging?` | `/straightuptax?` |

In `assert-staging-db-isolated.test.ts` the isolation check is host-based. Keep the IPs. Only change the database name in fixture URLs from `curatormtd` / `curatormtd_staging` to `straightuptax`.

- [ ] **Step 2: Run the host tests and confirm they fail for env-backed code, pass for fixtures**

Run:

```bash
bun test:unit src/test/unit/resolveApiBaseUrl.test.ts src/test/unit/resolveBundleServerEnv.test.ts src/test/unit/authDemoGuards.test.ts src/test/unit/apiRouter.test.ts src/test/unit/serveApiDocs.test.ts src/test/unit/serveApiDocsLogin.test.ts src/test/unit/uploadStorage.test.ts scripts/uncloud/helpers/assert-staging-db-isolated.test.ts
```

Expected: fixture-only tests PASS. `uploadStorage` PASS after the bucket string change (it reads the test mock, not live env).

- [ ] **Step 3: Update runtime defaults**

`src/env.ts`:

```ts
    HMRC_NATIVE_REDIRECT_URI: 'straightuptax://hmrc/callback',
    POSTMARK_FROM_EMAIL: 'hello@straightup.tax',
    INBOUND_EMAIL_DOMAIN: 'inbox.straightup.tax',
```

Change the production comment that says `api.curatormtd.co.uk` to `api.straightup.tax`.

`src/features/hmrc/server/config.ts`:

```ts
    return server.HMRC_NATIVE_REDIRECT_URI || 'straightuptax://hmrc/callback'
```

`src/api/openapi/info.ts` — change the two https server URLs to `https://staging-api.straightup.tax` and `https://api.straightup.tax`.

`src/uncloud/Caddyfile`:

```
app.straightup.tax {
	tls /config/certs/origin.pem /config/certs/origin.key
}
```

`src/uncloud/docker-compose.yml` defaults:

```
  HMRC_NATIVE_REDIRECT_URI: ${HMRC_NATIVE_REDIRECT_URI:-straightuptax://hmrc/callback}
  INBOUND_EMAIL_DOMAIN: ${INBOUND_EMAIL_DOMAIN:-inbox.straightup.tax}
  POSTMARK_FROM_EMAIL: ${POSTMARK_FROM_EMAIL:-hello@straightup.tax}
```

Then run `bun env:update` so compose markers stay in sync if `src/env.ts` changed the registry. If `env:update` rewrites the three defaults above, keep the new values.

`.env.production.example` — replace every `curatormtd.co.uk` host/email with the new map, `HMRC_NATIVE_REDIRECT_URI=straightuptax://hmrc/callback`, `GCS_RECEIPTS_BUCKET=straightuptax-receipts`, database path `/straightuptax`, `INBOUND_EMAIL_DOMAIN=inbox.straightup.tax`, `POSTMARK_FROM_EMAIL=hello@straightup.tax`, `ADMIN_EMAILS` example `ops@straightup.tax`. Leave secrets as placeholders.

`.env.staging.example` — same host/email/scheme/bucket/db-name replacements. **Strip any real passwords, tokens, or private keys** that are currently in this file. Use the same placeholder style as `.env.production.example` (`your-secret-key-here`, `postgresql://user:password@host:5432/straightuptax?sslmode=require`, `GCS_SERVICE_ACCOUNT_JSON={"type":"service_account",...}`).

`scripts/sst/helpers/deploy.ts` fallback:

```ts
  const url = process.env.ONE_SERVER_URL || 'https://api.straightup.tax'
```

`app/(app)/home/(tabs)/settings/index.tsx`:

```ts
  isDemoMode || import.meta.env.VITE_API_HOSTNAME === 'staging-api.straightup.tax'
```

`packages/cli/src/utils/env-categories.ts`:

```ts
        placeholder: 'straightuptax-receipts',
```

```ts
        instructions: 'Example: ops@straightup.tax,security@straightup.tax',
        placeholder: 'ops@straightup.tax',
```

```ts
        default: 'hello@straightup.tax',
```

`src/server/api-entry.ts` comment: `straightuptax://`.

`public/robots.txt`:

```
Sitemap: https://straightup.tax/sitemap.xml
```

- [ ] **Step 4: Re-run host tests and types**

Run:

```bash
bun test:unit src/test/unit/resolveApiBaseUrl.test.ts src/test/unit/resolveBundleServerEnv.test.ts src/test/unit/authDemoGuards.test.ts src/test/unit/apiRouter.test.ts src/test/unit/serveApiDocs.test.ts src/test/unit/serveApiDocsLogin.test.ts src/test/unit/uploadStorage.test.ts scripts/uncloud/helpers/assert-staging-db-isolated.test.ts
bun tko check types
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/test/unit/resolveApiBaseUrl.test.ts src/test/unit/resolveBundleServerEnv.test.ts src/test/unit/authDemoGuards.test.ts src/test/unit/apiRouter.test.ts src/test/unit/serveApiDocs.test.ts src/test/unit/serveApiDocsLogin.test.ts src/test/unit/uploadStorage.test.ts scripts/uncloud/helpers/assert-staging-db-isolated.test.ts src/env.ts src/api/openapi/info.ts src/features/hmrc/server/config.ts src/uncloud/Caddyfile src/uncloud/docker-compose.yml .env.production.example .env.staging.example scripts/sst/helpers/deploy.ts app/\(app\)/home/\(tabs\)/settings/index.tsx packages/cli/src/utils/env-categories.ts src/server/api-entry.ts public/robots.txt
git commit -m "feat: point infra hosts and env defaults at straightup.tax"
```

---

### Task 4: Product name surfaces

**Files:**
- Modify: `src/api/openapi/buildSpec.ts`
- Modify: `src/api/openapi/info.ts` (`OPENAPI_INFO_DESCRIPTION`)
- Modify: `src/features/hmrc/server/fraudHeaders.ts`
- Modify: `src/features/hmrc/components/HmrcConnectSection.tsx`
- Modify: `src/interface/app/Logo.tsx`
- Modify: `src/interface/splash/splash.tsx`
- Modify: `src/interface/app/LogoIcon.tsx`
- Modify: `api-docs/index.html`
- Modify: `public/favicon.svg`
- Modify: `flows/OpenApp.yaml`, `flows/Login.yaml`, `flows/Navigation.yaml`, `flows/WarmUp.yaml`
- Modify: `packages/cli/src/utils/prompts.ts`
- Modify: `packages/cli/src/utils/script-listing.ts`
- Modify: `packages/cli/src/utils/ports.ts`
- Modify: `packages/cli/src/commands/onboard.ts`
- Modify: `packages/cli/src/commands/env-setup.ts`
- Modify: `packages/cli/src/cli.ts`
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/README.md`
- Modify: `packages/cli/src/constants/ascii.ts` (comment only)
- Modify: `packages/scripts/src/build-initial.ts`
- Modify: `README.md`
- Modify: `LICENSE` first line if it names the product

**Interfaces:**
- Consumes: `APP_NAME` from Task 1 where a constant is already imported
- Produces: user-visible and HMRC vendor strings say `Straight Up Tax`; Maestro `appId: tax.straightup.dev` and visible `Straight Up Tax`

- [ ] **Step 1: Point OpenAPI and HMRC at the new name**

`src/api/openapi/buildSpec.ts`:

```ts
      title: 'Straight Up Tax API',
```

`src/api/openapi/info.ts` description first sentence:

```
HTTP API for the Straight Up Tax app. This document covers the **full api-service surface** served by the standalone API process (see route manifest).
```

`src/features/hmrc/server/fraudHeaders.ts` — import `APP_NAME` from `~/constants/app` and set:

```ts
    headers['Gov-Vendor-Product-Name'] = APP_NAME
```

```ts
  headers['Gov-Vendor-Forwarded'] = 'by=Straight-Up-Tax'
```

`src/features/hmrc/components/HmrcConnectSection.tsx` — replace `Authorise Curator MTD` with `Authorise Straight Up Tax`.

- [ ] **Step 2: Update UI, Maestro, CLI, and generated OpenAPI**

Logo / splash / favicon / api-docs title: replace `Curator MTD` / `CuratorMTD` with `Straight Up Tax`. `LogoIcon.tsx` comment: `straightuptax brandmark`.

Maestro: every `appId: uk.co.curatormtd.dev` → `appId: tax.straightup.dev`. Every visible `'Curator MTD'` → `'Straight Up Tax'`.

CLI/README/`build-initial.ts` welcome strings: `Straight Up Tax` (keep `@mtd/cli` package names).

`README.md` heading `# Straight Up Tax`.

Run:

```bash
bun run docs:openapi
```

Expected: `src/api/openapi.json` `info.title` is `Straight Up Tax API` and servers are the new hosts.

- [ ] **Step 3: Commit**

```bash
git add src/api/openapi/buildSpec.ts src/api/openapi/info.ts src/api/openapi.json src/features/hmrc/server/fraudHeaders.ts src/features/hmrc/components/HmrcConnectSection.tsx src/interface/app/Logo.tsx src/interface/splash/splash.tsx src/interface/app/LogoIcon.tsx api-docs/index.html public/favicon.svg flows/OpenApp.yaml flows/Login.yaml flows/Navigation.yaml flows/WarmUp.yaml packages/cli/src/utils/prompts.ts packages/cli/src/utils/script-listing.ts packages/cli/src/utils/ports.ts packages/cli/src/commands/onboard.ts packages/cli/src/commands/env-setup.ts packages/cli/src/cli.ts packages/cli/package.json packages/cli/README.md packages/cli/src/constants/ascii.ts packages/scripts/src/build-initial.ts README.md LICENSE
git commit -m "feat: rename product strings to Straight Up Tax"
```

If `LICENSE` was not changed, omit it. Do not add `packages/cli` if you only touched specific files — add those paths explicitly.

---

### Task 5: Operator docs

**Files:**
- Modify: `docs/deploy.md`
- Modify: `docs/deploy-uncloud.md`
- Modify: `docs/staging.md`
- Modify: `docs/api-service.md`
- Modify: `docs/architecture.md`
- Modify: `docs/native-release.md`
- Modify: `docs/email-receipt-capture.md`
- Modify: `docs/data-isolation.md`

**Interfaces:**
- Consumes: identifier map from the spec
- Produces: live docs/skills (symlinked from these files) use the new hosts, bundle IDs, scheme, buckets, inbound domain, and product name

- [ ] **Step 1: Replace live-doc infra strings**

In each file above, apply the same map as Task 3 plus:

| From | To |
|---|---|
| `uk.co.curatormtd.dev` | `tax.straightup.dev` |
| `uk.co.curatormtd.preview` | `tax.straightup.preview` |
| `uk.co.curatormtd.app` | `tax.straightup.app` |
| `group.uk.co.curatormtd.` | `group.tax.straightup.` |
| `curatormtd://` | `straightuptax://` |
| `curatormtd-receipts` | `straightuptax-receipts` |
| `Curator MTD` / `CuratorMTD` | `Straight Up Tax` |
| `mtdmail.curator.co.uk` | `inbox.straightup.tax` |
| `m.mtddone.co.uk` | `inbox.straightup.tax` |

Do not edit files under `docs/superpowers/plans` or `docs/superpowers/specs` except this plan / the already-committed design spec.

- [ ] **Step 2: Sanity-check skills still resolve**

Run: `bun tko docs list`

Expected: deploy, staging, api-service, architecture, native-release, email-receipt-capture still listed (frontmatter `name` / `description` unchanged unless a description mentioned the old host — if it did, update the description only).

- [ ] **Step 3: Commit**

```bash
git add docs/deploy.md docs/deploy-uncloud.md docs/staging.md docs/api-service.md docs/architecture.md docs/native-release.md docs/email-receipt-capture.md docs/data-isolation.md
git commit -m "docs: update operator docs to straightup.tax"
```

---

### Task 6: Repo-wide verification

**Files:**
- None new. This task only verifies leftovers.

- [ ] **Step 1: Search for remaining live references**

Run:

```bash
rg -i curatormtd --glob '!docs/superpowers/plans/**' --glob '!docs/superpowers/specs/**' --glob '!bun.lock'
```

Expected leftovers only:

- This plan and the design spec (if the globs did not exclude `2026-09-08-*`)
- GCP service account emails inside comments or example JSON (`curatormtd-receipts-staging@…`) — leave those
- Historical mentions you accidentally included — fix them in the file that is not a historical plan/spec

Also run:

```bash
rg -n 'uk\.co\.curatormtd|curatormtd://|api\.curatormtd|staging-api\.curatormtd|hello@curatormtd' --glob '!docs/superpowers/**'
```

Expected: no matches.

- [ ] **Step 2: Full unit + lint/types**

Run:

```bash
bun lint:fix && bun tko check types && bun test:unit
```

Expected: types clean; unit tests pass.

- [ ] **Step 3: Commit only if Step 1 required extra edits**

If leftover live files were fixed:

```bash
git add -u
git commit -m "chore: remove remaining live curatormtd infra strings"
```

If nothing changed, do not create an empty commit.

---

## Operator cutover (after merge — not a repo task)

Do this on staging first, then production. The app will not serve on the new hosts until DNS/env exist.

1. **DNS + TLS** — A records (Cloudflare proxied) for `api.straightup.tax` and `staging-api.straightup.tax` to the existing VMs. Issue/replace the origin cert so Caddy can serve `*.straightup.tax`. Point `app.straightup.tax` only when web ships.
2. **GCS** — create `straightuptax-receipts-staging` and `straightuptax-receipts`. Grant the existing service accounts objectAdmin (or the current role). Copy objects with the same keys (`gcloud storage cp -r gs://curatormtd-receipts-staging/* gs://straightuptax-receipts-staging/` and the prod pair). Flip `GCS_RECEIPTS_BUCKET` in `.env.staging` / `.env.production` / Bitwarden. Do not rename the service accounts.
3. **Postgres** — on each instance, as a role that is not connected to the app DB:

```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'curatormtd' AND pid <> pg_backend_pid();
ALTER DATABASE curatormtd RENAME TO straightuptax;
```

Then set `DEPLOY_DB` and `DATABASE_URL` paths to `/straightuptax`.

4. **Inbound addresses** — after `INBOUND_EMAIL_DOMAIN=inbox.straightup.tax` is live:

```sql
UPDATE "inboundEmailAddress"
SET "emailAddress" = token || '@inbox.straightup.tax'
WHERE "isActive" = true;
```

5. **Postmark** — verify `hello@straightup.tax`. Register inbound domain `inbox.straightup.tax` and MX to `inbound.postmarkapp.com`. Point the inbound webhook at `https://USER:PASSWORD@staging-api.straightup.tax/api/inbound-email/postmark` (then prod).
6. **OAuth** — add HMRC, Google, and Apple redirect URIs on the new api hosts (`/api/hmrc/callback`, `/api/auth/callback/google`, `/api/auth/callback/apple`). Register native `straightuptax://hmrc/callback`.
7. **Stores / Expo** — create Expo org `straightuptax`. Create Apple/Play apps for `tax.straightup.preview` and `tax.straightup.app` with App Groups `group.tax.straightup.preview` / `group.tax.straightup.app`. Old `uk.co.curatormtd.*` installs are a separate listing.
8. **Deploy + verify**

```bash
bun tko uncloud deploy-api --staging
curl -fsS https://staging-api.straightup.tax/api/health
curl -fsS https://staging-api.straightup.tax/api/handshake -H "x-app-version: 0.0.0"
```

Then the same for production (`api.straightup.tax`). Confirm OTP sign-in, an existing receipt still opens, Settings shows `{token}@inbox.straightup.tax`, and a test inbound message lands. Next native prebuild must report `tax.straightup.*` and `straightuptax://`.
