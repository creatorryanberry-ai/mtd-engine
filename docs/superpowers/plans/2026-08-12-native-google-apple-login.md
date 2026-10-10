# Native Google + Apple Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Google and Apple sign-in on native iOS/Android via better-auth social OAuth (system in-app browser), and remove Demo User login from staging/preview while keeping it for local/dev.

**Architecture:** Conditionally register `socialProviders.google` / `socialProviders.apple` on `authServer` when env secrets exist; Apple `clientSecret` is a JWT minted with `jose`. Native client calls `authClient.signIn.social` (Expo plugin opens auth session + deep-links back). Staging demo flags turned off in examples/docs/env; production already hard-fails if demo is on.

**Tech Stack:** better-auth `^1.3.32`, `@better-auth/expo`, `expo-web-browser` (already present), `jose` (add direct dep), Vitest, existing Tamagui login UI.

## Global Constraints

- Native only — no web social login work.
- Browser OAuth via `signIn.social` — not native ID-token SDKs, not raw WebView.
- Google + Apple buttons on both iOS and Android.
- Demo User: development only; staging/preview and production off.
- Only register a social provider when its required env vars are non-empty (OTP-only boots must keep working).
- Prefer `console.info`; lowercase comments; `~` imports outside `packages/*`.
- Commit messages: lowercase conventional one-liners per repo commit skill (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).

## File map

| File | Responsibility |
|------|----------------|
| `src/env.ts` | Declare Google/Apple OAuth env vars (empty defaults) |
| `.env.staging.example` / `.env.production.example` | Document vars; staging demo flags off |
| `src/features/auth/server/appleClientSecret.ts` | Mint Apple client-secret JWT |
| `src/features/auth/server/buildSocialProviders.ts` | Pure helper: which providers to enable from env |
| `src/features/auth/server/authServer.ts` | Wire `socialProviders` + Apple trusted origin |
| `src/features/auth/client/signInWithSocial.ts` | Client wrapper around `authClient.signIn.social` |
| `src/features/auth/ui/LoginSocialButtons.tsx` | Real buttons + loading/cancel/error toasts |
| `src/test/unit/buildSocialProviders.test.ts` | Unit tests for provider gating |
| `src/test/unit/appleClientSecret.test.ts` | Unit test JWT shape (mocked key or fixture) |
| `docs/staging.md` + `.claude/skills/staging/SKILL.md` (if symlink/copy) | Demo off; social callback URLs + checklist |
| `docs/architecture.md` | Auth blurb: email OTP + optional Google/Apple; demo local-only |

---

### Task 1: Env registry + staging demo flags off

**Files:**
- Modify: `src/env.ts`
- Modify: `.env.staging.example`
- Modify: `.env.production.example`
- Modify: `docs/staging.md` (demo table + social section)
- Modify: `docs/architecture.md` (auth paragraph)
- Run: `bun env:update` after `src/env.ts` change

**Interfaces:**
- Produces env keys (all strings, default `''` in `base`):
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`

- [ ] **Step 1: Add env keys to `src/env.ts` `base`**

Add alongside other auth-related keys (empty string defaults):

```ts
GOOGLE_CLIENT_ID: '',
GOOGLE_CLIENT_SECRET: '',
APPLE_CLIENT_ID: '',
APPLE_TEAM_ID: '',
APPLE_KEY_ID: '',
APPLE_PRIVATE_KEY: '',
```

Do not mark them `expected` — missing secrets must not fail boot.

- [ ] **Step 2: Update `.env.staging.example`**

Change demo flags to off and document social vars:

```bash
ALLOW_PUBLIC_AUTH=1
ALLOW_DEMO_AUTH=
VITE_ALLOW_PUBLIC_AUTH=1
VITE_DEMO_MODE=

# Social login (native OAuth via better-auth). Optional until credentials exist.
# Callbacks: https://staging-api.curatormtd.co.uk/api/auth/callback/google
#            https://staging-api.curatormtd.co.uk/api/auth/callback/apple
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# APPLE_CLIENT_ID=
# APPLE_TEAM_ID=
# APPLE_KEY_ID=
# APPLE_PRIVATE_KEY=
```

- [ ] **Step 3: Update `.env.production.example`**

Add the same commented social block with prod callback hosts (`https://api.curatormtd.co.uk/api/auth/callback/...`). Keep demo flags commented/off.

- [ ] **Step 4: Update docs**

In `docs/staging.md`:
- Remove claims that staging enables demo (`ALLOW_DEMO_AUTH=1` / `VITE_DEMO_MODE=1`).
- State demo is local/dev only; staging uses public OTP + optional Google/Apple.
- Add short social callback URL table + pointer to provider checklist (Task 5).

In `docs/architecture.md` auth section, replace “email OTP only … staging” with: email OTP + optional Google/Apple social on native; demo local/dev only; prod hard-fails if demo flags on.

If `.claude/skills/staging/SKILL.md` is a copy (not symlink), mirror the staging doc changes.

- [ ] **Step 5: Sync CI/docker env registry**

Run: `bun env:update`

Expected: succeeds; new keys appear in generated CI/compose env lists if applicable.

- [ ] **Step 6: Commit**

```bash
git add src/env.ts .env.staging.example .env.production.example docs/staging.md docs/architecture.md .claude/skills/staging/SKILL.md
# also add any files bun env:update modified
git commit -m "chore: add social auth env keys; disable staging demo flags"
```

---

### Task 2: `buildSocialProviders` helper (+ unit tests)

**Files:**
- Create: `src/features/auth/server/buildSocialProviders.ts`
- Create: `src/test/unit/buildSocialProviders.test.ts`

**Interfaces:**
- Consumes: plain env strings (not `server` object — keep pure for tests)
- Produces:

```ts
export type SocialEnv = {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  APPLE_CLIENT_ID: string
  APPLE_TEAM_ID: string
  APPLE_KEY_ID: string
  APPLE_PRIVATE_KEY: string
}

export type BuiltSocialProviders = {
  google?: { clientId: string; clientSecret: string }
  apple?: {
    clientId: string
    clientSecret: string // pre-minted JWT from caller, or see Task 3
    // Task 3 may instead return apple config with async secret — keep this helper
    // as “which providers + raw credentials”
  }
}

export function isGoogleSocialConfigured(env: Pick<SocialEnv, 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'>): boolean
export function isAppleSocialConfigured(
  env: Pick<SocialEnv, 'APPLE_CLIENT_ID' | 'APPLE_TEAM_ID' | 'APPLE_KEY_ID' | 'APPLE_PRIVATE_KEY'>,
): boolean
```

Prefer: helper returns `{ google?: { clientId, clientSecret }, apple?: { clientId, teamId, keyId, privateKey } }` and `authServer` mints the JWT. That keeps JWT generation in Task 3.

- [ ] **Step 1: Write failing tests**

```ts
// src/test/unit/buildSocialProviders.test.ts
import { describe, expect, it } from 'vitest'
import {
  isAppleSocialConfigured,
  isGoogleSocialConfigured,
  resolveSocialProviderCredentials,
} from '~/features/auth/server/buildSocialProviders'

const empty = {
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  APPLE_CLIENT_ID: '',
  APPLE_TEAM_ID: '',
  APPLE_KEY_ID: '',
  APPLE_PRIVATE_KEY: '',
}

describe('resolveSocialProviderCredentials', () => {
  it('returns no providers when env empty', () => {
    expect(resolveSocialProviderCredentials(empty)).toEqual({})
  })

  it('enables google only when both google vars set', () => {
    expect(
      resolveSocialProviderCredentials({
        ...empty,
        GOOGLE_CLIENT_ID: 'gid',
        GOOGLE_CLIENT_SECRET: 'gsecret',
      }),
    ).toEqual({
      google: { clientId: 'gid', clientSecret: 'gsecret' },
    })
  })

  it('ignores partial google config', () => {
    expect(isGoogleSocialConfigured({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: '' })).toBe(
      false,
    )
  })

  it('enables apple only when all apple vars set', () => {
    const env = {
      ...empty,
      APPLE_CLIENT_ID: 'com.example.si',
      APPLE_TEAM_ID: 'TEAM',
      APPLE_KEY_ID: 'KEY',
      APPLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nX\n-----END PRIVATE KEY-----',
    }
    expect(isAppleSocialConfigured(env)).toBe(true)
    expect(resolveSocialProviderCredentials(env).apple).toEqual({
      clientId: 'com.example.si',
      teamId: 'TEAM',
      keyId: 'KEY',
      privateKey: env.APPLE_PRIVATE_KEY,
    })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `bun test:unit -- src/test/unit/buildSocialProviders.test.ts`

Expected: FAIL (module missing)

- [ ] **Step 3: Implement helper**

```ts
// src/features/auth/server/buildSocialProviders.ts
export type SocialEnv = {
  GOOGLE_CLIENT_ID: string
  GOOGLE_CLIENT_SECRET: string
  APPLE_CLIENT_ID: string
  APPLE_TEAM_ID: string
  APPLE_KEY_ID: string
  APPLE_PRIVATE_KEY: string
}

export function isGoogleSocialConfigured(
  env: Pick<SocialEnv, 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET'>,
) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
}

export function isAppleSocialConfigured(
  env: Pick<
    SocialEnv,
    'APPLE_CLIENT_ID' | 'APPLE_TEAM_ID' | 'APPLE_KEY_ID' | 'APPLE_PRIVATE_KEY'
  >,
) {
  return Boolean(
    env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY,
  )
}

export function resolveSocialProviderCredentials(env: SocialEnv) {
  const out: {
    google?: { clientId: string; clientSecret: string }
    apple?: {
      clientId: string
      teamId: string
      keyId: string
      privateKey: string
    }
  } = {}

  if (isGoogleSocialConfigured(env)) {
    out.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }
  }

  if (isAppleSocialConfigured(env)) {
    out.apple = {
      clientId: env.APPLE_CLIENT_ID,
      teamId: env.APPLE_TEAM_ID,
      keyId: env.APPLE_KEY_ID,
      privateKey: env.APPLE_PRIVATE_KEY,
    }
  }

  return out
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `bun test:unit -- src/test/unit/buildSocialProviders.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/server/buildSocialProviders.ts src/test/unit/buildSocialProviders.test.ts
git commit -m "feat: add social provider credential resolver"
```

---

### Task 3: Apple client secret + wire `authServer` socialProviders

**Files:**
- Create: `src/features/auth/server/appleClientSecret.ts`
- Create: `src/test/unit/appleClientSecret.test.ts`
- Modify: `src/features/auth/server/authServer.ts`
- Modify: `package.json` — add `jose` dependency

**Interfaces:**
- Consumes: `resolveSocialProviderCredentials` + `server.*` env
- Produces: `generateAppleClientSecret(opts): Promise<string>`
- Produces: `authServer` with optional `socialProviders` and `trustedOrigins` including `https://appleid.apple.com` when Apple is configured (always safe to include)

- [ ] **Step 1: Add `jose`**

Run: `bun add jose`

- [ ] **Step 2: Write Apple JWT test**

Use a generated ES256 PKCS8 test key in the test file (or `jose`’s `generateKeyPair` + export PKCS8). Assert:
- JWT header `alg` is `ES256` and `kid` matches
- payload `iss` = teamId, `sub` = clientId, `aud` = `https://appleid.apple.com`

```ts
import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from 'jose'
import { describe, expect, it } from 'vitest'
import { generateAppleClientSecret } from '~/features/auth/server/appleClientSecret'

describe('generateAppleClientSecret', () => {
  it('mints a jwt with apple claims', async () => {
    const { privateKey } = await generateKeyPair('ES256')
    const pem = await exportPKCS8(privateKey)
    const token = await generateAppleClientSecret({
      clientId: 'com.example.si',
      teamId: 'TEAM123',
      keyId: 'KEY456',
      privateKey: pem,
    })
    const header = decodeProtectedHeader(token)
    const payload = decodeJwt(token)
    expect(header.alg).toBe('ES256')
    expect(header.kid).toBe('KEY456')
    expect(payload.iss).toBe('TEAM123')
    expect(payload.sub).toBe('com.example.si')
    expect(payload.aud).toBe('https://appleid.apple.com')
  })
})
```

- [ ] **Step 3: Run test — expect FAIL**

Run: `bun test:unit -- src/test/unit/appleClientSecret.test.ts`

- [ ] **Step 4: Implement `appleClientSecret.ts`**

```ts
import { importPKCS8, SignJWT } from 'jose'

export async function generateAppleClientSecret(opts: {
  clientId: string
  teamId: string
  keyId: string
  privateKey: string
}) {
  const key = await importPKCS8(opts.privateKey, 'ES256')
  const now = Math.floor(Date.now() / 1000)
  // apple rejects exp more than ~6 months out; use 180 days
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: opts.keyId })
    .setIssuer(opts.teamId)
    .setSubject(opts.clientId)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt(now)
    .setExpirationTime(now + 180 * 24 * 60 * 60)
    .sign(key)
}
```

Normalize `APPLE_PRIVATE_KEY` if stored with literal `\n` in env files:

```ts
export function normalizeApplePrivateKey(pem: string) {
  return pem.includes('-----BEGIN') ? pem.replace(/\\n/g, '\n') : pem
}
```

Call normalize inside `generateAppleClientSecret` before `importPKCS8`.

- [ ] **Step 5: Wire `authServer.ts`**

At module init (top-level await is OK in this Bun/TS server module if already used; otherwise build providers in an async factory). Prefer sync construction with a cached promise for Apple secret:

```ts
import { server } from '~/env'
import { resolveSocialProviderCredentials } from './buildSocialProviders'
import { generateAppleClientSecret, normalizeApplePrivateKey } from './appleClientSecret'

const socialCreds = resolveSocialProviderCredentials({
  GOOGLE_CLIENT_ID: server.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: server.GOOGLE_CLIENT_SECRET,
  APPLE_CLIENT_ID: server.APPLE_CLIENT_ID,
  APPLE_TEAM_ID: server.APPLE_TEAM_ID,
  APPLE_KEY_ID: server.APPLE_KEY_ID,
  APPLE_PRIVATE_KEY: server.APPLE_PRIVATE_KEY,
})

const socialProviders: Record<string, unknown> = {}

if (socialCreds.google) {
  socialProviders.google = {
    clientId: socialCreds.google.clientId,
    clientSecret: socialCreds.google.clientSecret,
  }
}

if (socialCreds.apple) {
  const apple = socialCreds.apple
  socialProviders.apple = {
    clientId: apple.clientId,
    clientSecret: await generateAppleClientSecret({
      clientId: apple.clientId,
      teamId: apple.teamId,
      keyId: apple.keyId,
      privateKey: normalizeApplePrivateKey(apple.privateKey),
    }),
  }
}
```

If top-level await is awkward in this file, use better-auth’s async provider form:

```ts
apple: async () => ({
  clientId: apple.clientId,
  clientSecret: await generateAppleClientSecret({ ... }),
}),
```

Add to `trustedOrigins` array (always):

```ts
'https://appleid.apple.com',
```

Pass `socialProviders` into `betterAuth({ ..., socialProviders })` only if `Object.keys(socialProviders).length > 0`, or pass `{}` — empty object is fine.

- [ ] **Step 6: Run unit tests**

Run:

```bash
bun test:unit -- src/test/unit/appleClientSecret.test.ts src/test/unit/buildSocialProviders.test.ts src/test/unit/authDemoGuards.test.ts
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock src/features/auth/server/appleClientSecret.ts src/features/auth/server/authServer.ts src/test/unit/appleClientSecret.test.ts
git commit -m "feat: wire google and apple social providers on auth server"
```

---

### Task 4: Client `signInWithSocial` + `LoginSocialButtons`

**Files:**
- Create: `src/features/auth/client/signInWithSocial.ts`
- Modify: `src/features/auth/ui/LoginSocialButtons.tsx`
- Optional test: `src/test/unit/signInWithSocial.test.ts` (mock `authClient`) if easy; otherwise manual verify notes only

**Interfaces:**
- Consumes: `authClient` from `~/features/auth/client/authClient`
- Produces:

```ts
export type SocialProvider = 'google' | 'apple'

export type SocialSignInResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; error: { code: string; message: string } }

export async function signInWithSocial(provider: SocialProvider): Promise<SocialSignInResult>
```

- [ ] **Step 1: Implement `signInWithSocial.ts`**

```ts
import { authClient } from './authClient'
import { standardizeBetterAuthError } from './betterAuthErrors'

export type SocialProvider = 'google' | 'apple'

export type SocialSignInResult =
  | { ok: true }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled?: false; error: { code: string; message: string } }

function isCancelledError(error: unknown) {
  const { code, message } = standardizeBetterAuthError(error)
  return (
    code === 'USER_CANCELLED' ||
    /cancel|cancelled|canceled|dismiss/i.test(message)
  )
}

export async function signInWithSocial(
  provider: SocialProvider,
): Promise<SocialSignInResult> {
  const { data, error } = await authClient.signIn.social({
    provider,
    // expo client converts this to curatormtd://… deep link
    callbackURL: '/home/feed',
  })

  if (error) {
    if (isCancelledError(error)) return { ok: false, cancelled: true }
    return { ok: false, error: standardizeBetterAuthError(error) }
  }

  // success path: expo plugin stores session; auth layout redirects when logged-in
  if (data) return { ok: true }
  return { ok: true }
}
```

- [ ] **Step 2: Wire `LoginSocialButtons.tsx`**

Replace coming-soon toast with real flow:

```tsx
import { useState } from 'react'
import { Separator, SizableText, Spinner, XStack } from 'tamagui'

import {
  signInWithSocial,
  type SocialProvider,
} from '~/features/auth/client/signInWithSocial'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { AppleIcon } from '~/interface/icons/AppleIcon'
import { GoogleIcon } from '~/interface/icons/GoogleIcon'
import { showToast } from '~/interface/toast/helpers'

export const LoginSocialButtons = () => {
  const [loading, setLoading] = useState<SocialProvider | null>(null)

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (loading) return
    setLoading(provider)
    try {
      const result = await signInWithSocial(provider)
      if (result.ok || ('cancelled' in result && result.cancelled)) return
      showToast(result.error.message || `${provider} login failed`, { type: 'error' })
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      {/* existing separator + or continue with */}
      <XStack gap="$3">
        <MtdActionButton
          flex={1}
          variant="secondary"
          disabled={!!loading}
          onPress={() => handleSocialLogin('google')}
          icon={
            loading === 'google' ? (
              <Spinner size="small" color={MTD_TOKENS.text} />
            ) : (
              <GoogleIcon size={20} color={MTD_TOKENS.text} />
            )
          }
        >
          Google
        </MtdActionButton>
        <MtdActionButton
          flex={1}
          variant="secondary"
          disabled={!!loading}
          onPress={() => handleSocialLogin('apple')}
          icon={
            loading === 'apple' ? (
              <Spinner size="small" color={MTD_TOKENS.text} />
            ) : (
              <AppleIcon size={22} color={MTD_TOKENS.text} />
            )
          }
        >
          Apple
        </MtdActionButton>
      </XStack>
    </>
  )
}
```

Keep existing separator / “or continue with” markup from the current file.

- [ ] **Step 3: Typecheck / lint touched files**

Run: `bun lint:fix && bun tko check types` (or at least ensure no TS errors on new files)

- [ ] **Step 4: Commit**

```bash
git add src/features/auth/client/signInWithSocial.ts src/features/auth/ui/LoginSocialButtons.tsx
git commit -m "feat: enable google and apple login buttons on native"
```

---

### Task 5: Provider setup checklist doc + verify

**Files:**
- Modify: `docs/staging.md` — add “Social login provider setup” section (Google Cloud + Apple Developer steps from the design spec)
- Optionally add a short note under auth in `docs/architecture.md` pointing to staging doc for operator setup
- Operator action (not code): update Bitwarden + real `.env.staging` / `.env.production` when credentials exist; clear `ALLOW_DEMO_AUTH` / `VITE_DEMO_MODE` in local `.env.staging` if still `1`

**Checklist content to paste into `docs/staging.md`:**

```markdown
## Social login (Google / Apple)

Native preview/production use better-auth OAuth in a system in-app browser.
Register these redirect URIs with each provider:

| Env | Google | Apple |
|-----|--------|-------|
| Staging | `https://staging-api.curatormtd.co.uk/api/auth/callback/google` | `https://staging-api.curatormtd.co.uk/api/auth/callback/apple` |
| Production | `https://api.curatormtd.co.uk/api/auth/callback/google` | `https://api.curatormtd.co.uk/api/auth/callback/apple` |

### Google Cloud

1. OAuth consent screen for the GCP project.
2. Create **Web application** OAuth client.
3. Add the staging + production redirect URIs (and optionally localhost for local Google).
4. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.staging` / `.env.production` and Bitwarden.

### Apple Developer

1. Enable **Sign In with Apple** on the app’s App ID(s).
2. Create a **Services ID** (`APPLE_CLIENT_ID`); configure domains/return URLs for staging + production Apple callbacks above.
3. Create a Sign In with Apple key; download `.p8` once; note Key ID + Team ID.
4. Set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (PEM; use `\n` for newlines in env files if needed).

Apple does not allow localhost return URLs — test Apple against staging (or an HTTPS tunnel).
```

- [ ] **Step 1: Write the staging checklist section**

- [ ] **Step 2: Full unit + check**

Run:

```bash
bun test:unit -- src/test/unit/buildSocialProviders.test.ts src/test/unit/appleClientSecret.test.ts src/test/unit/authDemoGuards.test.ts
bun check
```

Expected: PASS (or fix any formatting/type issues introduced)

- [ ] **Step 3: Remind operator (PR description)**

- Turn off demo in real `.env.staging` if still enabled; rebuild preview so `VITE_DEMO_MODE` is baked off.
- Add Google/Apple secrets when ready; redeploy staging API.
- Manual verify: Demo button gone on preview; Google/Apple sheets open; OTP still works.

- [ ] **Step 4: Commit**

```bash
git add docs/staging.md docs/architecture.md
git commit -m "docs: add google/apple oauth setup checklist for staging"
```

---

## Done when

- [ ] Social providers register only when env complete; OTP works with empty social env
- [ ] Login Google/Apple buttons call `signIn.social` (no “coming soon”)
- [ ] Staging example + docs: demo off; provider checklist present
- [ ] Unit tests for credential resolver + Apple JWT pass
- [ ] `bun check` clean for the change set
- [ ] Operator knows to update Bitwarden / `.env.staging` and rebuild preview

## Manual verification (after secrets)

1. `bun tko uncloud deploy-api --staging` with social env set
2. Rebuild preview native (`VITE_DEMO_MODE` empty)
3. Confirm no Demo button
4. Google sign-in → session → `/home/feed`
5. Apple sign-in → session → `/home/feed`
6. Email OTP still works
`)