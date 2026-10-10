# engine on vercel (private preview)

a private deployment of the app (including `/engine`) on vercel, protected by
vercel authentication so only members of the vercel team can open it. it signs
in with the demo account, so it is a demo, never a place for real tax data.

## how the build works

`vercel.json` points vercel at two scripts:

- `scripts/vercel/install.sh` installs the bun version pinned in
  `package.json` (`packageManager`) and runs `bun install --frozen-lockfile`
- `scripts/vercel/build.sh` runs `scripts/vercel/build.ts`, which:
  1. runs the database migrations (with a 2 minute per-migration timeout, see
     `MIGRATION_TIMEOUT_MS`) and, when `ENGINE_SEED_EMAIL` is set, seeds the
     demo workspace for that email (idempotent; safe on every build)
  2. builds the web app with one (`ONE_DEPLOY_TARGET=vercel`) into
     `.vercel/output`, keeping the static spa pages
  3. replaces one's per-route functions with a single node function
     (`src/server/vercel-api-entry.ts`, bundled by bun) that serves every
     `/api/*` route through the same router as the standalone api service
  4. rewrites `.vercel/output/config.json`: `/api/*` goes to that function,
     static files and clean urls are served from the filesystem, dynamic pages
     rewrite to their spa shell, everything else is the 404 page

`src/server/vercelEnv.ts` derives `BETTER_AUTH_URL`, `API_SERVER_URL`,
`ONE_SERVER_URL` and the `VITE_*` host values from the project production url
(production deploys) or `VERCEL_BRANCH_URL` (previews), so nothing needs to know
the deployment url in advance. it also swaps `DATABASE_URL` for
`DATABASE_URL_UNPOOLED` when present: row-level security context is set per
session, which a transaction pooler would break. the package is
`sideEffects: false`, so it is called explicitly, never imported for effect.

`isRealProductionRuntime` treats a deployment whose auth and api urls are both
on `*.vercel.app` as a private preview, like staging: the demo account
(`demo@straightup.tax`, code `000000`) works there and nowhere in real
production. the project must keep vercel authentication on for that reason.

## setup

1. vercel project `mtd-engine` (framework: other, node 24), deployed from a
   github repo vercel can read (currently a snapshot copy in the owner's
   personal account). the ignored build step only builds `feat/engine-phase-2`.
2. storage: neon postgres from the vercel marketplace, connected to the
   project. it provides `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. environment variables (production and preview):

   | key | value |
   | --- | --- |
   | `BETTER_AUTH_SECRET` | random, 32+ characters |
   | `ALLOW_PUBLIC_AUTH`, `VITE_ALLOW_PUBLIC_AUTH` | `1` |
   | `ENGINE_ENABLED`, `VITE_ENGINE_ENABLED` | `1` |
   | `ALLOW_DEMO_AUTH`, `VITE_DEMO_MODE` | `1` |
   | `ENGINE_SEED_EMAIL` | `demo@straightup.tax` |

   to sign in with real email codes instead, add `POSTMARK_SERVER_TOKEN` and
   `POSTMARK_FROM_EMAIL` and seed the workspace for that address.

   optional: `ANTHROPIC_API_KEY` for llm features, stripe / hubspot keys for
   live connectors.
4. deployment protection: vercel authentication on every `*.vercel.app` url.
5. deploy `feat/engine-phase-2`.

## signing in

open the project url, sign in to vercel if asked, then use "try demo" on the
login screen (or `demo@straightup.tax` with code `000000`). use the project
url, not a per-commit url: auth trusts only the origin it was built for.

## limitations

- no background worker. the pg-boss queue still accepts jobs, but nothing
  runs them, so connector syncs, the scheduled experiment refresh and the
  nightly metric rollup do not happen. the refresh and recompute buttons in
  the ui run inline and do work.
- one function serves the whole api (60s max duration). server-sent events
  stay open only until that limit.
- the demo seed writes synthetic data into the connected database.

## check locally

```bash
SKIP_DB=1 ALLOW_MISSING_ENV=1 NODE_ENV=production \
  BETTER_AUTH_URL=http://localhost:8090 bun scripts/vercel/build.ts
```

the output lands in `.vercel/output` (gitignored).
