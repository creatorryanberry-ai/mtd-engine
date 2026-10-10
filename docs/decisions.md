# Engine decisions

Architecture decisions for the autonomous sales and marketing engine ("engine" in code). The build prompt that drives this work is summarised in [engine-phase-1.md](./engine-phase-1.md). Each entry records what we chose, why, and what it rules out. Later phases append below.

## 2026-10-10 Build inside this repo on its existing stack

The build prompt specifies Turborepo + pnpm, Next.js, tRPC, Temporal, Clerk/Supabase Auth and Vercel. This repo already ships a universal app on One (file routing, SSR, api routes), Tamagui, Bun workspaces, Drizzle, better-auth, pg-boss and a standalone Bun api bundle. Re-platforming would throw away working auth, deploy, env management, RLS, migrations and CI for no measurement or product gain, so the engine is built here as a feature slice.

Mapping from the prompt's stack to what we use:

- Monorepo: Bun workspaces (`packages/*`) instead of Turborepo + pnpm.
- Web app: One + Tamagui instead of Next.js + shadcn. Same React Server Components direction (One SSR/SSG), TanStack Query is already here.
- API: One `+api.ts` route handlers documented through `defineRoute` (valibot) and the generated OpenAPI spec, instead of tRPC + a separate REST layer. Valibot replaces Zod because the repo already standardises on it.
- Durable workflows: pg-boss (already deployed as the `worker` service) instead of Temporal. Agents in later phases are pg-boss jobs with a run log table. If a phase needs real saga semantics we revisit Temporal then.
- Auth and orgs: better-auth users plus our own `engineWorkspace` / `engineMembership` tables carrying the Owner, Admin, Marketer, Approver, Viewer roles, instead of Clerk organisations.
- Database: PostgreSQL + Drizzle as specified. pgvector is available in the docker image; the embedding column lands in Phase 3 with the asset tagger so Phase 1 migrations stay runnable on the lite (orez) backend.
- Event store: Postgres tables with time-based indexes. ClickHouse is deferred until event volume justifies it.
- Object storage: existing GCS/MinIO storage helpers.
- ML service (Python/FastAPI, bandits, uplift, MMM): Phase 5+. Phase 1 defines the prediction and model registry tables it writes to.
- Observability: existing PostHog + console logging; `engineLlmCall` is the Langfuse substitute until Phase 8.

## 2026-10-10 Naming and placement

- Server and client code lives in `src/features/engine/` (sub-folders per loop stage: `sense`, `guard`, `create`, `deploy`, `measure`, `learn`, plus `core` for workspaces and `llm` for the gateway).
- Tables are prefixed `engine` (camelCase like the rest of the schema) so they never collide with tax tables (`events`, `orders`, `products`) and can be lifted out into their own database later.
- Routes live under `/api/engine/*` and screens under `/engine/*`.

## 2026-10-10 Tenancy and row-level security

The tax product isolates by `userId`. The engine is multi-tenant per workspace, so every engine table carries `workspaceId`. Access is enforced twice:

1. In code: `requireWorkspaceAccess(request, workspaceId, minimumRole)` resolves the better-auth user, checks `engineMembership`, and binds the request to the user with `enterUserDbContext`.
2. In Postgres: a custom migration enables RLS on every engine table with a policy that allows a row when `app.bypass_rls = on` or when the row's `workspaceId` has a membership for `app.user_id`. Workers run under bypass only until they know the workspace, then under the acting user or a dedicated system actor.

Mutations always take the workspace id from the authenticated membership, never from the request body.

## 2026-10-10 Money and the reward signal

Amounts are stored as integer minor units (`amountMinor`, pence) with a three-letter `currency`, never floats. Gross profit on an order is `revenueMinor - costMinor - feesMinor - refundedMinor`. Orders carry `source` (`stripe`, `shopify`, `crm`, `manual`) and `externalId`, and the pair is unique per workspace so webhooks and backfills are idempotent. Metrics roll up from orders and events, never from platform-reported revenue.

## 2026-10-10 LLM gateway

All model calls go through `src/features/engine/llm/gateway.ts` using the official `@anthropic-ai/sdk`. Two tiers are configured: `strategy` (Claude Opus 5.5) for planning and reflection and `fast` (Claude Haiku 5.5) for tagging, scoring and classification. Every call writes an `engineLlmCall` row with prompt, model, token counts, cost, latency and output, and the gateway refuses to run once a workspace's monthly LLM budget is spent. Secrets are never interpolated into prompts; connector tokens are decrypted only inside connector modules.

## 2026-10-10 Connectors

Revenue sources implement `RevenueConnector` and channels implement `ChannelConnector` (`connect`, `sync`, `publish`, `pause`, `fetchMetrics`). Phase 1 ships Stripe (webhook + backfill) and HubSpot (OAuth + contact/company/deal sync). OAuth tokens are encrypted at rest with the existing AES-256-GCM helper. External HTTP uses `fetch` directly with retry and rate-limit handling rather than vendor SDKs, keeping the api bundle small.

## 2026-10-10 Audit log

Every autonomous or privileged action writes `engineAuditLog` with actor (`user:<id>` or `system:<agent>`), action, entity, before/after JSON and the reasoning string. The log is append-only: no update or delete route exists and the RLS policy only grants SELECT and INSERT.

## 2026-10-10 Phase 2: how the engine measures lift

Measurement is the source of truth the later learning stages train on, so its rules are fixed here.

- Unit of analysis is the contact, intent to treat. Every contact assigned to a group counts in that group's denominator whether or not a message ever reached them. Outcomes count when they happen after assignment and inside the experiment window.
- The reward is gross profit per contact from `engineOutcome` (purchase, first purchase, deal won). Conversion rate is reported alongside but is only primary when an experiment opts into it.
- Gross profit per contact uses Welch's t interval, because profit is heavy-tailed and group variances differ. Conversion rate uses the Newcombe hybrid score interval, a two-proportion z test, and a beta-binomial probability that treatment beats baseline. Every interval is 95%.
- No result is called before both groups reach the experiment's minimum sample per arm (default 200). Below that the verdict is `collecting`, whatever the interval says.
- Every experiment checks for sample ratio mismatch with a chi-square test against the intended split. A p-value below 0.001 marks the result untrustworthy and it is surfaced as a warning.
- Assignment is deterministic: a SHA-256 of the experiment salt and contact id gives a uniform draw, mapped to holdout or an arm by weight. Re-running assignment never moves anyone.
- The workspace keeps a permanent holdout (default 5%) chosen by the contact's hash bucket. Those contacts are excluded from every experiment population and every automated send, and the dashboard's incremental profit compares them with everyone else. Changing the rate is audited because it restarts that baseline.
- Attribution is triangulated, never blended. First-party multi-touch credit (last touch, first touch, linear, time decay with a 7-day half-life, position based 40/20/40) over a 30-day lookback sits beside platform-reported numbers and holdout-backed experiment lift. When they disagree the report raises a flag instead of averaging. The media mix model column stays empty until phase 7.
- All statistics live in one isomorphic module, `src/features/engine/measure/stats.ts`, tested against scipy, statsmodels and Monte Carlo references, so the server and the sample size calculator in the UI cannot drift.
