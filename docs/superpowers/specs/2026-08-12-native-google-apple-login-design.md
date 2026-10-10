---
name: native-google-apple-login
description: Add Google and Apple OAuth on native via better-auth social + in-app browser; remove demo login from staging/preview.
---

# Native Google + Apple login design

## Goal

Ship real Google and Apple sign-in on the native apps (iOS + Android), using better-auth social OAuth in a system in-app browser auth session. Remove Demo User login from staging/preview and production. Keep email OTP. Keep Demo User for local/dev only.

## Decisions (approved)

1. **Native only** — no web app login surface for social auth.
2. **Approach: browser OAuth** — `authClient.signIn.social({ provider })` with Expo/`expo-web-browser` auth session (ASWebAuthenticationSession / Chrome Custom Tabs), not a raw WebView, not native ID-token SDKs.
3. **Both providers on both platforms** — Google and Apple buttons on iOS and Android.
4. **Demo User** — local/dev only; off on staging (preview) and production.
5. **Credentials** — not ready yet; include a provider setup checklist as part of the work (docs + env examples).
6. **Email OTP** — remains an available sign-in path.

## Non-goals

- Web login / web OAuth UI
- Native ID-token SDKs (`@react-native-google-signin/*`, `expo-apple-authentication`) in this iteration
- Custom account-merge UI beyond better-auth defaults
- Changing production hard-fail for demo flags (already in place)

## Supersedes

The auth-hardening design (`2026-07-31-auth-hardening-design.md`) kept staging demo login on purpose. **This design turns staging/preview demo off.** Production demo remains forbidden.

## Architecture

```
LoginSocialButtons (native)
  → authClient.signIn.social({ provider, callbackURL })
  → Expo opens system auth session sheet
  → Google / Apple OAuth
  → redirect to BETTER_AUTH_URL /api/auth/callback/{provider}
  → better-auth session + deep link return (curatormtd://…)
  → auth state logged-in
  → existing auth/_layout Redirect → /home/feed
```

New social users still run `afterCreateUser` (public user, userState, default bank accounts). Existing `account` table stores provider links.

## Server

### `authServer`

- Configure `socialProviders.google` with `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- Configure `socialProviders.apple` with Service ID as `clientId` and a JWT `clientSecret` generated from `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (better-auth docs pattern; add `jose` if not already a dependency).
- Add `https://appleid.apple.com` to `trustedOrigins`.
- Keep `BETTER_AUTH_URL` as the OAuth redirect base (already used).
- Do not enable email/password.
- Only register a provider in `socialProviders` when its required env vars are present (so missing secrets do not break OTP-only boots).

### Auth gates

- Social routes stay under existing `ALLOW_PUBLIC_AUTH` / `rejectPublicAuthIfDisabled` (same as OTP).
- Demo reject path unchanged; staging simply stops setting demo flags.

### Callback URLs (register with providers)

| Env | Return URLs to register |
|-----|-------------------------|
| Staging | `…/api/auth/callback/google` and `…/api/auth/callback/apple` on `https://staging-api.curatormtd.co.uk` |
| Production | same paths on `https://api.curatormtd.co.uk` |
| Local (Google only) | `http://localhost:<web-port>/api/auth/callback/google` |

Apple does **not** allow `localhost` or non-HTTPS return URLs. Local Apple testing requires staging or an HTTPS tunnel.

## Environment

Add to `src/env.ts` (and examples / Bitwarden / `bun env:update` as needed):

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret |
| `APPLE_CLIENT_ID` | Apple Service ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `APPLE_KEY_ID` | Sign in with Apple key ID |
| `APPLE_PRIVATE_KEY` | `.p8` private key contents (PEM string) |

Defaults empty in development so local boots without social. Staging/prod supply real values when enabling social. Prefer failing social sign-in with a clear error if unset, rather than crashing API boot when credentials are missing (so preview can ship OTP-first before secrets land).

### Demo flags

| Env | `ALLOW_DEMO_AUTH` | `VITE_DEMO_MODE` |
|-----|-------------------|------------------|
| development | `1` | `1` |
| staging / preview | off | off |
| production | off (hard-fail if on) | off (hard-fail if on) |

Update `.env.staging.example`, staging skill/docs, and any copy that still says staging keeps demo login.

## Client

- Replace “coming soon” toast in `LoginSocialButtons` with real `signIn.social` for `google` | `apple`.
- Use a post-login `callbackURL` that the expo client turns into a `curatormtd://` deep link (same pattern as better-auth Expo social docs).
- Loading state on buttons; cancel/dismiss of the auth sheet → no error toast spam (silent or short info).
- Failures → existing `standardizeBetterAuthError` + toast.
- Success → existing auth layout redirect when `state === 'logged-in'`.
- Show Google and Apple on both platforms. If the server rejects an unconfigured provider, surface a clear toast.

## Account linking

- Keep current better-auth `account.accountLinking` settings.
- Same-email OTP ↔ social linking uses better-auth defaults; no custom merge UI.
- Apple “Hide My Email” / email-only-on-first-auth: accept whatever better-auth persists; no special UI in this work.

## Provider setup checklist (docs deliverable)

Document in staging/auth-related docs (and/or this spec appendix in the implementation plan):

### Google Cloud

1. Create (or reuse) a GCP project OAuth consent screen.
2. Create **Web application** OAuth client ID.
3. Authorized redirect URIs: staging + production callback URLs above; optionally localhost for local Google.
4. Put client ID/secret into `.env.staging` / `.env.production` and Bitwarden.

### Apple Developer

1. App ID (bundle id for preview/prod variants as used today) with **Sign In with Apple**.
2. **Services ID** (this is `APPLE_CLIENT_ID`) with Sign In with Apple configured:
   - Domains: `curatormtd.co.uk` (and staging host as required by Apple’s domain/return URL rules).
   - Return URLs: staging + production Apple callback URLs above.
3. Create a **Sign In with Apple** key; download `.p8` once; note Key ID + Team ID.
4. Put Service ID, Team ID, Key ID, and PEM into env / Bitwarden.

## Testing

- Unit: demo staging example/flags; social config helpers if extracted; existing demo-guard tests stay green.
- Local CI / Playwright demo helpers: unchanged (development still has demo).
- Manual: Google + Apple on staging preview builds after credentials exist; Google optional locally; Apple not expected on localhost.

## Rollout

1. Land code + docs + staging example with demo off.
2. Operator fills Google/Apple secrets in Bitwarden + `.env.staging` / `.env.production`.
3. Register provider redirect URLs.
4. Deploy staging API; rebuild preview native so `VITE_DEMO_MODE` is off in the bundle.
5. Verify social + OTP; confirm Demo button absent on preview.
6. Production secrets + deploy when ready (demo already blocked).
