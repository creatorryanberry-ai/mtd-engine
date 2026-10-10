---
name: environment
description: Env vars and .env files — src/env.ts, createEnv, Bitwarden vault, env:update, VITE_ prefix, MTD_ENV_MODE.
---

# environment

All environment variables are declared in one place: `src/env.ts`, using `createEnv` from `@mtd/env`. Nothing reads `process.env` ad hoc — if a variable isn't registered there, it doesn't exist as far as the app is concerned.

## the env files

`.env*` files are gitignored. Completed copies for each environment live in the team Bitwarden vault — ask a developer to share the collection if you don't have access.

- `.env.development` — managed by `src/env.ts` and regenerated with working defaults on first dev run (`bun backend` / `bun dev`). You rarely need the Bitwarden copy; grab it only for real sandbox credentials (HMRC).
- `.env.production` — production deploy config and secrets. From Bitwarden. There is a committed `.env.production.example` showing the shape.
- `.env.staging` — staging deploy config (api-only environment used by preview builds). From Bitwarden; `.env.staging.example` is committed.
- `.env.local` — optional personal overrides layered on top; never committed. `bun env:dev` reapplies this file after regenerating localhost defaults, so Metro sees it. Vite also needs `.env.development.local` for `VITE_*` because it loads `.env.development` after `.env.local`.
- `.env.ios` / `.env.android` — build artifacts written by the native release tooling; don't edit by hand.

If you rotate or add a secret, update the copy in Bitwarden too, so the next developer (and future you) gets the current values.

## declaring variables

In `src/env.ts`:

- use the `expected` sentinel for variables that must be provided at runtime (deploys fail loudly if they're missing)
- use a plain string for defaults
- put dev-only values in the `development` section (it receives computed `ports` and a `pgUrl` helper), production values in `production`
- prefix with `VITE_` anything the client bundle is allowed to see; everything else stays server-only

Access values through the exports of `src/env.ts`. Use `server.X` for secrets — it throws if accessed from client code, which catches accidental leaks at runtime.

After changing `src/env.ts`, run:

```bash
bun env:update
```

which syncs the variable registry into the CI workflow and docker-compose files. `bun scripts/env/sync-to-github.ts` pushes values to GitHub Actions secrets for CI deploys.

## modes and tooling

`NODE_ENV` picks which section applies (`development` or `production`; `test` is treated as development). Staging is not a mode — it runs in production mode with staging values from `.env.staging` (see [staging](./staging.md)).

Scripts that need to resolve env for a target mode without inheriting the parent process's `NODE_ENV` set `MTD_ENV_MODE` (see `packages/scripts/src/helpers/env-load.ts`). The release/test helpers use this to keep child test processes pinned to development while the outer flow runs production-flavored.

`PORT_OFFSET` shifts every registered port by a fixed amount, letting two checkouts run side by side. When it's set, the managed `.env.development` is left untouched.

Useful commands:

```bash
bun env:dev            # print resolved development env
bun env:prod           # print resolved production env
bun run:dev <cmd>      # run a command with development env applied
bun run:prod <cmd>     # run a command with production env applied
```
