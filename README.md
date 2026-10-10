# Straight Up Tax

Making Tax Digital compliance app for UK sole traders and landlords. Users record income and expenses, connect bank accounts, and submit quarterly updates to HMRC under MTD for Income Tax.

One codebase ships iOS, Android, and web from a single set of React components, built on [One](https://onestack.dev) (React Native + web framework) and [Tamagui](https://tamagui.dev) (universal UI). The backend is a Bun server with PostgreSQL (Drizzle ORM), [better-auth](https://better-auth.com) for authentication, pg-boss for background jobs, and integrations with HMRC, Postmark (email), and PostHog (analytics + feature flags).

## Repo layout

- `app/` — file-based routes (screens and `/api/**` endpoints)
- `src/` — application code: `features/`, `interface/` (shared UI), `database/` (schema + migrations), `server/`, `jobs/`, and `env.ts`
- `packages/` — workspace packages (`@mtd/cli`, `@mtd/database`, `@mtd/env`, `@mtd/helpers`, …) including the `tko` CLI
- `scripts/` — project scripts run via `bun tko …` (deploy, release, db, checks)
- `docs/` — developer docs; most are also exposed as agent skills
- `flows/` — Maestro end-to-end flows for the native app

See [docs/architecture.md](./docs/architecture.md) for how it all fits together.

## Getting started

Install Node and Bun to match `package.json` (`engines.node` and `packageManager`). The team usually uses [n](https://github.com/tj/n) for Node plus the official Bun installer; Ruby (for Fastlane) via chruby or rbenv. Platform notes (macOS / OrbStack, WSL / Docker Engine or `bun lite`) and other version managers are in [docs/getting-started.md](./docs/getting-started.md).

Short version once those are in place:

```bash
./scripts/bootstrap.sh   # verifies bun/docker and runs bun install
bun onboard              # interactive setup wizard — choose "Complete setup"
```

Then in separate terminals:

```bash
bun backend   # docker services (postgres + minio) + migrations
bun dev       # web dev server → http://localhost:8081
APP_VARIANT=preview bun ios   # optional: iOS preview build (macOS + Xcode)
```

On a resource-constrained WSL machine, prefer `bun lite` instead of `bun backend` — see the WSL section in the getting-started guide.

## Environment variables

All variables are defined in `src/env.ts`. The `.env*` files are gitignored; completed copies for each environment are stored in the team **Bitwarden** vault — ask a developer for access if you don't have it.

- `.env.development` — auto-generated with working defaults on first run; only pull from Bitwarden if you need real sandbox credentials (HMRC)
- `.env.production` / `.env.staging` — required for deploys; copy from Bitwarden into the repo root
- `.env.local` — optional personal overrides, never committed

More detail in [docs/environment.md](./docs/environment.md).

## Everyday commands

```bash
bun dev                # web + mobile dev server
bun backend            # docker services + migrations
bun check              # lint, types, dependencies
bun lint:fix           # format + autofix lint issues
bun db:migrate         # generate + run database migrations
bun test:unit          # vitest unit tests
bun ops release --dry-run   # full CI suite (backend + integration tests)
bun storybook          # design system (port 6006)
bun api-docs           # REST API reference (port 6007)
bun tko docs list      # list all developer docs
```

## Testing

Unit tests (vitest) run standalone with `bun test:unit`. Integration tests (Playwright) need the backend and dev server running — the simplest path is `bun ops release --dry-run`, which sets everything up itself. For fast iteration against a running backend and dev server:

```bash
cd src/test
bunx playwright test integration/auth.test.ts
```

See the [testing guide](./docs/testing-integration.md) for fixtures, demo login, and debugging failures.

## Deployment

Everything deploys with Uncloud to self-hosted VPSes; native apps release through Fastlane (no EAS).

```bash
bun tko uncloud deploy-api --production   # production: api + worker
bun tko uncloud deploy-api --staging      # staging: api + worker
bun tko uncloud deploy-web --production   # production web only (deferred)
bun tko uncloud deploy-web --staging      # staging web only (deferred)
bun tko release preview                   # native stores (web default commented out)
bun tko release preview --web             # staging web via uncloud
bun tko uncloud deploy-local              # local rehearsal in an OrbStack VM
```

Read first: [deployment overview](./docs/deploy.md), [Uncloud deploys](./docs/deploy-uncloud.md), [staging](./docs/staging.md), [api service](./docs/api-service.md), and [native releases](./docs/native-release.md) (TestFlight / Play Store).

## Documentation

- Setup: [getting started](./docs/getting-started.md), [environment](./docs/environment.md)
- Understanding the code: [architecture](./docs/architecture.md), [database](./docs/database.md), [routing](./docs/one-routes.md), [Tamagui](./docs/tamagui.md)
- Operating: [deployment](./docs/deploy.md), [staging](./docs/staging.md), [native releases](./docs/native-release.md)

The full set is in [docs/](./docs) — run `bun tko docs list` to browse. Most docs double as Claude Code skills (symlinked into `.claude/skills/`; regenerate with `bun tko skills generate`).

## License

Proprietary — see [LICENSE](./LICENSE). Not open source.
