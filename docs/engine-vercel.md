# engine on vercel (private preview)

a private, signed-in deployment of the app (including `/engine`) on vercel.
it is a preview deployment of the `feat/engine-phase-2` branch, protected by
vercel authentication, so only members of the vercel team can open it.

## how the build works

`vercel.json` points vercel at two scripts:

- `scripts/vercel/install.sh` installs the bun version pinned in
  `package.json` (`packageManager`) and runs `bun install --frozen-lockfile`
- `scripts/vercel/build.sh` runs `scripts/vercel/build.ts`, which:
  1. runs the database migrations and, when `ENGINE_SEED_EMAIL` is set, seeds
     the demo workspace for that email (idempotent; safe on every build)
  2. builds the web app with one (`ONE_DEPLOY_TARGET=vercel`) into
     `.vercel/output`, keeping the static spa pages
  3. replaces one's per-route functions with a single node function
     (`src/server/vercel-api-entry.ts`, bundled by bun) that serves every
     `/api/*` route through the same router as the standalone api service
  4. rewrites `.vercel/output/config.json`: `/api/*` goes to that function,
     static files and clean urls are served from the filesystem, dynamic pages
     rewrite to their spa shell, everything else is the 404 page

`src/server/vercelEnv.ts` derives `BETTER_AUTH_URL`, `API_SERVER_URL`,
`ONE_SERVER_URL` and the `VITE_*` host values from `VERCEL_BRANCH_URL`, so
nothing needs to know the deployment url in advance. it also swaps
`DATABASE_URL` for `DATABASE_URL_UNPOOLED` when present: row-level security
context is set per session, which a transaction pooler would break.

## setup

1. vercel project linked to `curator-org-uk/mtd` (framework: other, node 24).
   the ignored build step only builds `feat/engine-phase-2`.
2. storage: add neon postgres from the vercel marketplace and connect it to
   the project for preview. it provides `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED`.
3. environment variables (preview):

   | key | value |
   | --- | --- |
   | `BETTER_AUTH_SECRET` | random, 32+ characters |
   | `ALLOW_PUBLIC_AUTH`, `VITE_ALLOW_PUBLIC_AUTH` | `1` |
   | `ENGINE_ENABLED`, `VITE_ENGINE_ENABLED` | `1` |
   | `ENGINE_SEED_EMAIL` | the email that should own the demo workspace |
   | `POSTMARK_SERVER_TOKEN` | postmark server api token |
   | `POSTMARK_FROM_EMAIL` | a sender verified in postmark |

   optional: `ANTHROPIC_API_KEY` for llm features, stripe / hubspot keys for
   live connectors.
4. deployment protection: vercel authentication on (standard protection).
5. push to `feat/engine-phase-2`, or redeploy the latest preview.

## signing in

open the branch url (`<project>-git-feat-engine-phase-2-<team>.vercel.app`),
sign in to vercel if asked, then sign in to the app with the
`ENGINE_SEED_EMAIL` address. the code arrives by email through postmark;
production builds never accept the `000000` demo code. use the branch url,
not the per-commit url: auth trusts only the origin it was built for.

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
