---
name: architecture
description: How the repo fits together — One routes, features, packages, services (web/api/worker), database, integrations.
---

# architecture

Straight Up Tax is a universal app: one React codebase produces the iOS app, the Android app, and the web app. [One](https://onestack.dev) provides file-based routing and the server runtime; [Tamagui](https://tamagui.dev) provides the UI system that renders natively and on the web.

## runtime services

Production deploys **api + worker** by default (see [deploy](./deploy.md)). Web is deferred and ships independently via `deploy-web` when needed:

- **api** — a standalone Bun bundle (`dist/api.js`) serving `/api/**` for the native apps (see [api-service](./api-service.md))
- **worker** — pg-boss background job runner (`dist/worker.js`)
- **web** — the One app server: SSR/SSG web pages plus `/api/**` routes (not deployed by default)

PostgreSQL is an external managed database. Object storage for receipts is private Google Cloud Storage in staging/production; local/dev uses MinIO.

Locally, `bun dev` runs the One dev server and `bun backend` runs postgres + minio in Docker with migrations applied.

## directory map

```
app/                file-based routes (One)
  (app)/            authenticated app screens
  (legal)/          terms, privacy, eula
  api/              server endpoints (*+api.ts)
  *_+ssg.tsx        static-generated marketing/help pages
src/
  features/         vertical slices: auth, business, hmrc, bankAccounts, submission,
                    categorisation, mileage, onboarding, notification, …
  interface/        shared UI components (Tamagui)
  database/         drizzle schema, relations, migrations, migrate.ts
  server/           standalone api entry + generated route manifest
  jobs/             pg-boss job definitions
  env.ts            the single env var registry (see environment doc)
  test/             vitest + playwright integration tests
packages/           workspace packages (@mtd/*)
  cli/              the `tko` CLI (onboard, docs, skills, run, …)
  database/         drizzle/migration utilities
  env/              createEnv used by src/env.ts
  helpers/          shared utilities (storage, emitters, time, …)
  better-auth-utils/, native-hot-update/, run/, scripts/
scripts/            project scripts run via `bun tko …` (deploy, release,
                    db, checks, icons)
flows/              maestro e2e flows for the native app
docs/               these docs; most double as agent skills
```

Feature folders keep client and server code together — a typical feature has `client/`, `server/`, and shared files. Server-only modules import `server-only` or live under `server/` so they can't leak into the client bundle.

## routing

Routes are files in `app/` (see [one-routes](./one-routes.md)):

- `*.tsx` — screens, rendered natively and on web
- `*+ssg.tsx` — static-generated web pages
- `api/**/*+api.ts(x)` — HTTP endpoints; these also make up the standalone api's route manifest (regenerate with `bun api:manifest` when routes change)
- `_layout.tsx` / `_layout.native.tsx` — platform-specific shells
- `.native.tsx` suffix — native-specific implementation of a shared component

## data

Schema lives in `src/database/schema.ts` (Drizzle ORM). Migrations are generated from the schema — edit the schema, run `bun db:migrate`, never write migration SQL by hand (see [database](./database.md)). Denormalised counts are maintained by postgres triggers ([aggregates](./aggregates.md), [triggers](./triggers.md)).

User tax/financial data is isolated per account (`userId`) with application filters plus Postgres RLS. See [data-isolation](./data-isolation.md).

## auth

[better-auth](https://better-auth.com) with email OTP plus optional Google/Apple social sign-in on native (no password, magic-link, or phone auth). Demo login (`ALLOW_DEMO_AUTH` + fixed OTP) is local/dev only; real production deploy/boot hard-fails if demo flags are on. Public sign-in is gated by `ALLOW_PUBLIC_AUTH` (off by default in production until launch). Sessions are cookie-based and shared across subdomains in production; the native app uses the better-auth expo plugin with the `straightuptax://` scheme. Operator setup for Google/Apple credentials: see [staging — Social login](./staging.md#social-login-google--apple).

## integrations

- **HMRC** — MTD for Income Tax APIs; OAuth callback at `/api/hmrc/callback`, sandbox credentials in dev/staging
- **Postmark** — transactional email (OTP codes)
- **PostHog** — analytics and feature flags (feature flags also gate OTA hot updates)
- **APNS / FCM** — push

## native app lifecycle

Local and store native builds share the same identities: set `APP_VARIANT=preview` (`tax.straightup.preview`, staging API) or `APP_VARIANT=production` (`tax.straightup.app`). There is no separate `.dev` bundle ID — `bun ios` / `bun android` without one of those variants fails. Store releases go through Fastlane ([native-release](./native-release.md)). Between store releases, JS-only fixes ship over the air via hot-updater ([hot-updater](./hot-updater.md), [native-hot-update](./native-hot-update.md)), with a version handshake as the force-upgrade backstop ([api-service](./api-service.md)).
