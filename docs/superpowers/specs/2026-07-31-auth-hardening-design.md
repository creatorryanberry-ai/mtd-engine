---
name: auth-hardening
description: Lock production against demo/misconfig auth risks; remove unused auth surfaces; fix impersonation/logging.
---

# Auth hardening design

## Goal

Make production impossible to misconfigure into the demo/backdoor auth risks we identified, while keeping email OTP as the real product login path. Staging stays intentionally open for preview/demo.

## Decisions (approved)

1. **Hard-fail production if demo flags are on** — allow `ALLOW_PUBLIC_AUTH` for launch.
2. **Never log OTPs / magic / phone codes in production mode** (staging included — staging uses `NODE_ENV=production`).
3. **Remove magic-link and phone auth plugins** until real delivery exists.
4. **Block better-auth `/admin/*` HTTP surface** (impersonation included); keep app-level admin via `role` + `ADMIN_EMAILS`.

## Non-goals

- Changing the email OTP product flow
- Removing staging demo login (`ALLOW_DEMO_AUTH=1` on staging remains)
- Building a new staff admin console
- Encrypting more tax fields (out of scope)

## Threats addressed

| Threat | Fix |
|--------|-----|
| Prod with `ALLOW_DEMO_AUTH=1` → fixed OTP `000000` | Deploy assert + boot assert + runtime gate |
| OTP / magic / phone secrets in API logs | Stop plaintext logging when `NODE_ENV=production` |
| Magic-link / phone session via log-scraped tokens | Remove plugins + client wiring |
| Admin impersonation (`duration: 0` → 1h) | Deny all `/api/auth/admin/*` in `apiHandler` |
| Unused better-auth admin HTTP (ban, set-role, …) | Same deny-list |
| Docs claiming impersonation is disabled | Update `docs/data-isolation.md` |

## Design

### 1. What “production” means for asserts

Staging runs **production mode** with staging values. Distinguishing:

| Layer | How we know it’s real prod |
|-------|----------------------------|
| Deploy | `parseUncloudEnvTarget() === 'production'` (`--production`) |
| Boot (api) | `NODE_ENV === 'production'` **and** `BETTER_AUTH_URL` / `API_SERVER_URL` do **not** contain `staging-api.` |

Local `NODE_ENV=development` is unchanged (demo allowed).

### 2. Demo flags — three layers

**Forbidden on real production:** `ALLOW_DEMO_AUTH`, `VITE_DEMO_MODE` (truthy `1` / `true`).

**Allowed:** `ALLOW_PUBLIC_AUTH` / `VITE_ALLOW_PUBLIC_AUTH` (product sign-in).

Layers:

1. **Deploy** — `assertProdAuthFlags()` called from `deploy-api` / `deploy-web` when `target === 'production'`. Throws before ship.
2. **Boot** — same check in `api-entry` (and any web server entry that loads auth env) when runtime is real prod. Process refuses to start.
3. **Runtime** — `isDemoAuthAllowed()` returns false on real prod even if env is wrongly set (defense in depth for `generateOTP` / demo reject paths). Prefer a shared helper e.g. `isStagingApiHost()` / `isProductionDeployTarget()`.

Unit-test the assert helper and `isDemoAuthAllowed` matrix (dev / staging host / prod host × flag on/off).

### 3. Logging

In `authServer` email OTP `sendVerificationOTP`:

- If `NODE_ENV === 'production'`: log only that an OTP was issued for the email (no code).
- Else (local/dev): keep current plaintext OTP log for DX.
- `storeOTP` remains development-only (already).

Magic-link / phone send handlers go away with the plugins (see below).

### 4. Remove magic-link + phone

**Server:** drop `magicLink` and `phoneNumber` from `authServer` plugins.

**Client:** drop `magicLinkClient` / `phoneNumberClient` from `plugins.ts`.

**App code:** narrow `otpLogin` / pending challenge types to email-only (remove dead phone branches). Signup UI already forces email.

**OpenAPI / docs:** remove any phone/magic auth paths if documented; keep email OTP only.

### 5. Admin HTTP surface

Keep the better-auth `admin()` plugin **only if needed for the `role` column / schema compatibility**. Do **not** expose its HTTP API:

In `apiHandler`, before forwarding to better-auth:

- If pathname includes `/api/auth/admin` → `403` with a clear message (always, all envs).

Optionally remove `adminClient()` from the client plugins (no app callers).

App admin stays:

- `getIsAdmin` / `ensureAuth(..., 'admin')` = `role === 'admin'` **or** email in `ADMIN_EMAILS`
- Used for quarterly unsubmit when demo auth is off

There is **no admin login UI**. Staff use normal email OTP on an account that already has admin role / allowlist email.

Fix incorrect docs: impersonation is blocked by route deny, not by `impersonationSessionDuration: 0`. Prefer setting a non-zero duration only if we ever re-enable; until then document “admin routes denied”.

### 6. Docs / examples

- `.env.production.example`: explicitly warn never set `ALLOW_DEMO_AUTH` / `VITE_DEMO_MODE`; note deploy/boot will fail.
- `docs/staging.md` / architecture / data-isolation: demo allowed only on staging/dev; prod hard-fails demo flags; no password/admin login; `/admin/*` closed.
- `docs/testing-integration.md`: already demo OTP (verify no “admin login” leftovers).

## Out of scope follow-ups (optional later)

- **Re-enable impersonation** — keep `admin()` for `role` compatibility; today’s blanket `/api/auth/admin/*` deny is intentional and reversible. To bring impersonation back: allow only `/admin/impersonate-user` (+ stop), use a real non-zero `impersonationSessionDuration` (never `0` — better-auth treats it as falsy → 1h), restrict to `role=admin` / `ADMIN_EMAILS`, add audit logging, preferably stage first.
- Server-gate clear-transactions / clear-rules with `isDemoAuthAllowed()` (today any authed user can hit those DELETE APIs)
- Custom better-auth access control stripping `impersonate` (redundant if `/admin/*` denied)
- Temporary pre-launch padlock forbidding `ALLOW_PUBLIC_AUTH` on prod until launch day

## Success criteria

- Production deploy with `ALLOW_DEMO_AUTH=1` fails assert
- Prod api process with demo flag + non-staging URL refuses to boot
- Staging with demo + public auth still works
- No plaintext OTP in production-mode logs
- `/api/auth/admin/impersonate-user` returns 403 even with `role=admin` and public auth on
- Magic-link / phone auth routes no longer registered
- `bun test:unit` covers new assert / demo-gate helpers
