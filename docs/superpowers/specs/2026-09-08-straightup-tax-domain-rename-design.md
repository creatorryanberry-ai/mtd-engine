# Straight Up Tax domain and identity rename

## Goal

Replace the `curatormtd.co.uk` / `curatormtd` infra identity with `straightup.tax` / `straightuptax` so deploys, native builds, auth, email, and operator docs no longer point at the old domain. After the cutover, staging and production keep working against the new hosts, buckets, database name, and inbound mail domain.

## Decisions (approved)

1. **Approach** — live infra + operator docs. Historical `docs/superpowers/plans` and `specs` stay as written.
2. **Product name** — `APP_NAME` is `Straight Up Tax`.
3. **Apex domain** — `DOMAIN` is `straightup.tax`. Better-auth trusted origins and cross-subdomain cookies use `.straightup.tax`.
4. **Hosts** — production api `api.straightup.tax`, staging api `staging-api.straightup.tax`, deferred web `app.straightup.tax`.
5. **Mail** — from-address examples `hello@straightup.tax`. Inbound receipt dropbox `inbox.straightup.tax` (`INBOUND_EMAIL_DOMAIN`). Twitter `https://x.com/straightuptax`.
6. **Native IDs** — new store listings. Bundle IDs stay reverse-DNS of the domain: `tax.straightup.dev` / `tax.straightup.preview` / `tax.straightup.app`. App Groups `group.tax.straightup.*`.
7. **Identifier stem** — package name, Expo slug, Expo owner, URL scheme, and `APP_NAME_LOWERCASE` are `straightuptax`. Scheme is `straightuptax://`.
8. **Xcode stems** — `StraightUpTax` / `StraightUpTaxPreview` / `StraightUpTaxDev` (and matching Live Activity names). Generated `ios/` / `android/` trees are not in git; the next prebuild picks this up.
9. **GCS** — buckets `straightuptax-receipts` and `straightuptax-receipts-staging`. Copy existing objects with the same keys, grant the current service accounts access, then flip `GCS_RECEIPTS_BUCKET`. Do not rename GCP service account emails.
10. **Postgres** — rename the live app database on staging and production to `straightuptax` and update `DEPLOY_DB` / `DATABASE_URL`. Isolation remains host-based (separate instances), not name-based.
11. **Inbound addresses** — one-off SQL on each live database rewrites active `inboundEmailAddress.emailAddress` to `token@inbox.straightup.tax` so Settings matches the new webhook domain.
12. **Expo owner** — `straightuptax` (org must exist or be created outside this repo).

## Identifier map

| Role | Old | New |
|---|---|---|
| Product name | Curator MTD | Straight Up Tax |
| Apex / cookie domain | curatormtd.co.uk | straightup.tax |
| Production api | api.curatormtd.co.uk | api.straightup.tax |
| Staging api | staging-api.curatormtd.co.uk | staging-api.straightup.tax |
| Web (deferred) | app.curatormtd.co.uk | app.straightup.tax |
| From-address | hello@curatormtd.co.uk | hello@straightup.tax |
| Inbound mail | mtdmail.curator.co.uk / m.mtddone.co.uk | inbox.straightup.tax |
| Twitter | x.com/curatormtd | x.com/straightuptax |
| Bundle IDs | uk.co.curatormtd.{dev,preview,app} | tax.straightup.{dev,preview,app} |
| App Groups | group.uk.co.curatormtd.* | group.tax.straightup.* |
| Scheme / slug / package / Expo owner | curatormtd / curator-ltd | straightuptax |
| Xcode stems | CuratorMTD* | StraightUpTax* |
| GCS buckets | curatormtd-receipts(-staging) | straightuptax-receipts(-staging) |
| Postgres database | curatormtd | straightuptax |

## Non-goals

- Rewriting historical `docs/superpowers/plans` and `specs`
- Renaming `@mtd/*` workspace packages, the git repo folder, or GitHub `curator-org-uk/mtd`
- Renaming GCP service accounts
- Automating DNS, Cloudflare Access, Apple/Play app creation, Postmark MX, or Expo org creation
- Changing inbound-email processing behaviour (still capture-to-Inbox only)

## In-repo surfaces

Canonical constants: `src/constants/app.ts` (`DOMAIN`, `APP_NAME`, `APP_NAME_LOWERCASE`, constructed URLs and demo/admin emails) and `src/features/auth/constants.ts` (`APP_SCHEME`). Auth trusted origins and cookie domain follow `DOMAIN`.

Native identity: `app.config.ts` plus release helpers (`scripts/release/helpers/env.ts`, `android-autolinking.ts`, `run-native.ts`, `scripts/android/setup-release.ts`) and Fastlane docs.

Deploy / env: `.env.production.example`, `.env.staging.example` (keep placeholders, no live secrets), `src/env.ts`, Caddy, compose defaults, OpenAPI server URLs. After `src/env.ts` changes, run `bun env:update`.

Operator docs that double as skills: `docs/deploy.md`, `docs/deploy-uncloud.md`, `docs/staging.md`, `docs/api-service.md`, `docs/architecture.md`, `docs/native-release.md`, `docs/email-receipt-capture.md`, `docs/data-isolation.md`. Skills are symlinks from docs with `name` / `description` frontmatter.

Tests and Maestro: unit tests that hardcode old hosts, scheme, buckets, or DB names; Maestro `appId` and visible app name. Product strings that come from `APP_NAME` (logo, HMRC vendor name, OpenAPI title) change with the constant.

## Live cutover (operator)

Required for a working deploy:

- DNS + TLS + Caddy for `api.straightup.tax` and `staging-api.straightup.tax` (`app.straightup.tax` when web ships)
- Update gitignored `.env.staging` / `.env.production` and Bitwarden: api URLs, auth URL, HMRC callback, Postmark from-address, inbound domain, scheme, DB name, GCS bucket
- Register HMRC / Google / Apple redirect URIs on the new api hosts
- Postmark: verify `hello@straightup.tax`; MX for `inbox.straightup.tax` → inbound Postmark
- Rewrite active inbound addresses to `@inbox.straightup.tax`
- Create `straightuptax-receipts` and `straightuptax-receipts-staging`, copy objects with the same keys, grant existing service accounts access, flip `GCS_RECEIPTS_BUCKET`
- On each isolated Postgres instance, disconnect clients and `ALTER DATABASE curatormtd RENAME TO straightuptax`, then point `DEPLOY_DB` / `DATABASE_URL` at the new name
- Create Expo org `straightuptax` and new Apple/Play apps + App Groups for `tax.straightup.*`

Existing installed apps keep `uk.co.curatormtd.*`. New listings are a new identity. Sessions on the old cookie domain are invalid after the host cutover; users sign in again.

## Testing

In repo: `bun lint:fix && bun tko check types` and `bun test:unit`. After the change, `rg -i curatormtd` should only hit historical plans/specs (and any documented leftover IAM emails).

Live, after DNS/env flip: health + handshake on both api hosts; OTP sign-in; receipt upload and open of an existing receipt; Inbox address shows `@inbox.straightup.tax` and a test inbound message lands; native prebuild uses `tax.straightup.*` and `straightuptax://`.
