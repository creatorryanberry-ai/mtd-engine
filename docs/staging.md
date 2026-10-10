---
name: staging
description: Staging environment — api-only at staging-api.straightup.tax, isolated db, preview builds.
---

# staging

Staging gives the preview/TestFlight app a real backend that never touches production data. It is api-only: the standalone api service at `staging-api.straightup.tax`, with no web app shipped.

Staging is not a separate build mode. It runs in production mode with staging values on isolated infrastructure: its own VM, its own uncloud context (`staging`), and its own managed Postgres instance (different host from production).

## config

Staging config lives in `.env.staging`, which is gitignored. Copy the committed template and fill in real values:

```bash
cp .env.staging.example .env.staging
openssl rand -hex 32   # fresh BETTER_AUTH_SECRET — do not reuse prod
```

The important values point everything at the api host: `API_SERVER_URL`, `VITE_API_HOSTNAME`, and `BETTER_AUTH_URL` are all `https://staging-api.straightup.tax`, `DEPLOY_DB` / `DATABASE_URL` point at the staging Postgres instance (different host from production), and `UNCLOUD_CONTEXT=staging`. HMRC stays on sandbox credentials; the HMRC redirect uri is registered at `https://staging-api.straightup.tax/api/hmrc/callback`.

Staging enables public sign-in (production leaves these empty/off until launch). Demo login is **local/dev only** — staging/preview use email OTP plus optional Google/Apple social when credentials are set:

| var | purpose |
|---|---|
| `ALLOW_PUBLIC_AUTH=1` | server allows email OTP and social auth routes |
| `VITE_ALLOW_PUBLIC_AUTH=1` | preview app shows login UI |

Without `ALLOW_PUBLIC_AUTH` the api returns `403 Sign in is not available` for every auth attempt (staging runs in production *mode*, which defaults those gates off). Do not set `ALLOW_DEMO_AUTH` or `VITE_DEMO_MODE` on staging — demo is for local development only. Real production deploy/boot **hard-fails** if demo flags are on.

Optional social OAuth env vars (`GOOGLE_CLIENT_*`, `APPLE_*`) enable native Google/Apple sign-in when populated. See [Social login (Google / Apple)](#social-login-google--apple) for provider setup.

Receipt and avatar uploads on staging require GCS (`GCS_RECEIPTS_BUCKET`, `GCS_SERVICE_ACCOUNT_JSON`). Prefer a dedicated staging bucket (e.g. `straightuptax-receipts-staging`). Receipts stay private (signed URLs); avatars/public uploads use object ACLs (`public: true`) under `uploads/` / `avatars/`. Local MinIO is not available on the staging VM.

## Social login (Google / Apple)

Native preview/production use better-auth OAuth in a system in-app browser.
Register these redirect URIs with each provider:

| Env | Google | Apple |
|-----|--------|-------|
| Staging | `https://staging-api.straightup.tax/api/auth/callback/google` | `https://staging-api.straightup.tax/api/auth/callback/apple` |
| Production | `https://api.straightup.tax/api/auth/callback/google` | `https://api.straightup.tax/api/auth/callback/apple` |

### Google Cloud

1. OAuth consent screen for the GCP project.
2. Create **Web application** OAuth client.
3. Add the staging + production redirect URIs (and optionally localhost for local Google).
4. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.staging` / `.env.production` and Bitwarden.

### Apple Developer

1. Enable **Sign In with Apple** on the app's App ID(s).
2. Create a **Services ID** (`APPLE_CLIENT_ID`); configure domains/return URLs for staging + production Apple callbacks above.
3. Create a Sign In with Apple key; download `.p8` once; note Key ID + Team ID.
4. Set `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (PEM; use `\n` for newlines in env files if needed).

Apple does not allow localhost return URLs — test Apple against staging (or an HTTPS tunnel).

## deploy

Prerequisites (personal SSH user, key, uncloud context, env file) are the same as production — see [deploy](./deploy.md#prerequisites). In `.env.staging` set `DEPLOY_USER` to your OS username on the staging VM and `DEPLOY_SSH_KEY=~/.ssh/uncloud_deploy`.

```bash
bun tko uncloud deploy-api --staging
```

This loads `.env.staging`, targets the `staging` uncloud context, runs migrations against the staging Postgres instance, and deploys the `api` and `worker` services — the same default backend deploy as production. It shares the deploy core with production (`scripts/uncloud/helpers/deploy-core.ts`); only the env file and uncloud context differ. Web is independent: `bun tko uncloud deploy-web --staging` when needed.

Deploy skips when the local api fingerprint matches `.mtd/api-deploy/staging.json`. If inputs changed, you get an interactive bump for `API_RELEASE_VERSION` (default patch), or use `--bump patch|minor|major` / `--force` / `--no-skip-unchanged`. After shipping a release bump in a PR, refresh the CI baseline with `bun tko api accept-release`.

Api updates use the same start-first rolling strategy as production (brief overlap of old + new container; see [deploy-uncloud](./deploy-uncloud.md#zero-downtime-api-updates)).

Requires a `staging-api.straightup.tax` A record pointing at the staging VM. Once Cloudflare Access protects `/docs`, that record must be **Proxied** (orange cloud) so Access can gate browser traffic. The single-level host (not `api.staging.…`) is covered by the existing Cloudflare Universal SSL and `*.straightup.tax` origin cert with no extra certificate.

## preview builds

Preview native builds (iOS + Android) resolve URLs from one file only:

| variant | env file |
|---|---|
| preview | `.env.staging` |
| production | `.env.production` |
| local dev | `.env.development` |

No other `.env*` files are involved. Ambient `process.env` is ignored for URL resolution. iOS injects via a build artifact (`ios/.xcode.env.local`); Android via the release process environment (`--no-daemon` so gradle cannot retain stale values). See [api-service](./api-service.md) for the host mapping.

## api docs

Scalar OpenAPI UI is served at `https://staging-api.straightup.tax/docs` because staging sets `ENABLE_API_DOCS=1` and the api image includes a built `dist/api-docs/` tree (see [api-service](./api-service.md)). A public landing page at `/login` (outside Access) links into the docs; Sign out returns there after clearing the Access session.

Cloudflare Access gates `/docs*` only — Google sign-in, `@curator.org.uk` email domain. `/api/**` and `/login` stay open so preview/TestFlight clients never hit an Access login. This is intentional: the mobile app uses app-level auth, not browser SSO.

The OpenAPI spec at `/docs` documents the full api-service surface, including auth routes (`/api/auth/**`).

To try protected routes in Scalar: send an OTP with `POST /api/auth/email-otp/send-verification-otp` (`type: "sign-in"`), complete `POST /api/auth/sign-in/email-otp` with the code, copy the `token` from the response, then set Authorization Bearer in Scalar's auth panel.

Cloudflare Access on `/docs` only gates who can open the docs UI in a browser — it is not API authentication. Protected `/api/**` routes still require a session cookie or Bearer token from app auth.

Manual Cloudflare setup (not automated in deploy scripts):

1. **DNS** — orange-cloud (Proxied) `staging-api.straightup.tax`; confirm SSL mode matches production origin cert setup.
2. **Access application** — Zero Trust → Access → add application on that hostname with path include `/docs*`.
3. **Identity** — Google IdP; policy allows emails ending in `@curator.org.uk`.
4. **Verify api still public** — no Access cookie required:

   ```bash
   curl -fsS https://staging-api.straightup.tax/api/health
   curl -fsS https://staging-api.straightup.tax/api/handshake -H "x-app-version: 0.0.0"
   ```

5. **Verify docs gated** — open `https://staging-api.straightup.tax/docs` in a private window; expect Cloudflare Access login. After signing in with a `@curator.org.uk` Google account, Scalar should load the OpenAPI spec.

## verify

```bash
curl -fsS https://staging-api.straightup.tax/api/health
curl -fsS https://staging-api.straightup.tax/api/handshake -H "x-app-version: 0.0.0"
```

Confirm isolation by checking that data created via the preview app appears only in the staging Postgres instance, never in production.
