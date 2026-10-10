# Engine phase 1: foundation

The engine is the autonomous, self-learning sales and marketing operating system described in the build prompt (closed loop: sense, decide, create, guard, deploy, measure, learn). Phase 1 ships the foundation it all plugs into: tenancy, brand kit, the full data model, the event pipeline, a revenue connector (Stripe), a CRM connector (HubSpot), the LLM gateway, the audit log and a dashboard skeleton. Stack decisions are in [decisions.md](./decisions.md).

## Layout

```
src/database/engineSchema.ts            all engine tables (engine* prefix, workspaceId scoped)
src/database/migrations/*-enable-engine-rls.ts   membership-based row level security
src/features/engine/
  contract.ts                           valibot schemas shared by routes and client
  core/ids.ts, core/money.ts            id helpers, minor-unit money and gross profit
  core/server/workspaceAccess.ts        requireWorkspaceAccess(request, workspaceId, role)
  core/server/audit.ts                  writeAudit (append-only)
  core/server/credentials.ts            encrypt/decrypt connector credentials
  core/server/*.ts                      workspace, membership, brand, brand kit services
  sense/server/identity.ts              resolveContact (identity resolution)
  sense/server/*.ts                     events, orders, contacts, dashboard
  channels/ChannelConnector.ts          ChannelConnector + RevenueConnector interfaces
  channels/registry.ts                  connector lookup by key
  channels/stripe/, channels/hubspot/   phase 1 connectors
  providers/ProviderAdapter.ts          media/copy generation interface (adapters in phase 3)
  llm/gateway.ts                        the single Anthropic entry point, logs engineLlmCall
  client/                               react-query hooks for the screens
app/api/engine/**                       routes (defineRoute + valibot, documented in OpenAPI)
app/(app)/engine/**                     screens
scripts/db/seed-engine.ts               synthetic business for demos and tests
```

## Conventions for every engine module

- Routes use `defineRoute` with `input`/`output` schemas from `src/features/engine/contract.ts`, tag `engine`, and call `requireWorkspaceAccess(request, params.workspaceId, role)`. The workspace id always comes from the path.
- Raw handlers (webhooks, OAuth callbacks) are documented in `src/api/openapi/engine.ts` so the OpenAPI coverage check passes. After adding routes run `bun api:manifest`.
- Ids come from `newId('<prefix>')`: `ws`, `mem`, `br`, `bk`, `ct`, `co`, `idn`, `cs`, `dl`, `ord`, `ch`, `cn`, `oas`, `ev`, `out`, `aud`, `llm`, `job`.
- Money is integer minor units with a currency column. Gross profit via `grossProfitMinor()` in `core/money.ts`.
- Every mutation that an agent could later perform autonomously writes an audit entry with `writeAudit`.
- Secrets: connector credentials go through `core/server/credentials.ts`; nothing from `engineConnection.credentialsEncrypted` is ever returned by an api or passed to the LLM.
- Code style follows CLAUDE.md: `~` imports, lowercase sparse comments, `console.info`, no `any`, named exports.

## Routes

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| GET | /api/engine/workspaces | user | workspaces the user belongs to, with role |
| POST | /api/engine/workspaces | user | create workspace (bootstraps owner membership, default channels, autonomy settings, guardrails) |
| GET, PATCH | /api/engine/workspaces/:workspaceId | viewer, admin | read / update settings incl. kill switch and budgets |
| GET, POST | /api/engine/workspaces/:workspaceId/members | viewer, admin | list / add member by email (user must already exist) |
| PATCH, DELETE | /api/engine/workspaces/:workspaceId/members/:memberId | admin | change role / remove |
| GET, POST | /api/engine/workspaces/:workspaceId/brands | viewer, marketer | brands |
| PATCH | /api/engine/workspaces/:workspaceId/brands/:brandId | marketer | update brand |
| GET, PUT | /api/engine/workspaces/:workspaceId/brands/:brandId/kit | viewer, marketer | current kit / save a new version |
| POST | /api/engine/workspaces/:workspaceId/brands/:brandId/kit/import | marketer | draft a kit from a website url with the LLM (not saved; user reviews then PUTs) |
| GET | /api/engine/workspaces/:workspaceId/audit | viewer | audit log, paginated |
| POST, GET | /api/engine/workspaces/:workspaceId/events | marketer, viewer | ingest batch / list recent |
| GET | /api/engine/workspaces/:workspaceId/contacts | viewer | contacts, paginated |
| GET | /api/engine/workspaces/:workspaceId/orders | viewer | orders, paginated |
| GET | /api/engine/workspaces/:workspaceId/dashboard | viewer | command centre summary |
| GET | /api/engine/workspaces/:workspaceId/llm/calls | admin | recent llm calls with cost |
| GET | /api/engine/connectors | user | connector catalog with configured flags |
| GET | /api/engine/workspaces/:workspaceId/connections | viewer | connections (no secrets) |
| POST | /api/engine/workspaces/:workspaceId/connections/connect/:provider | admin | start connect (oauth url or api key) |
| POST | /api/engine/workspaces/:workspaceId/connections/:connectionId/sync | marketer | enqueue a sync job |
| DELETE | /api/engine/workspaces/:workspaceId/connections/:connectionId | admin | disconnect |
| GET | /api/engine/connections/hubspot/callback | public | oauth callback |
| POST | /api/engine/webhooks/stripe/:connectionId | public | signed stripe webhook |

## Environment variables

Declared in `src/env.ts`; `bun env:update` syncs them to CI and docker files.

- `ENGINE_ENABLED`, `VITE_ENGINE_ENABLED`: feature gate (on in development).
- `ANTHROPIC_API_KEY`: console.anthropic.com. `ENGINE_LLM_STRATEGY_MODEL` (default claude-opus-5-5) and `ENGINE_LLM_FAST_MODEL` (default claude-haiku-5-5).
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`: optional platform-level defaults; workspaces can supply their own restricted key through the connect flow.
- `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`, `HUBSPOT_REDIRECT_URI`: a HubSpot public app with scopes `crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read oauth`.
- `HIGGSFIELD_API_KEY` (console.higgsfield.ai, billed separately from the subscription) and `ELEVENLABS_API_KEY`: phase 3, declared now so the integrations screen can show status.

Third-party accounts to create: Anthropic Console, Stripe (restricted key with read access to charges, invoices, customers, refunds, balance transactions; webhook endpoint), HubSpot developer account with a public app, Higgsfield API console, ElevenLabs.

## How to run

```bash
bun backend            # or `bun lite` without docker
bun db:migrate
bun run:dev scripts/db/seed-engine.ts   # synthetic workspace "Northstar Roofing" with contacts, orders, events
bun dev                # http://localhost:8081/engine
bun test:unit
```

## Demo script (2 minutes)

1. Sign in with the demo account, open Settings and tap Growth engine. Create the workspace "Northstar Roofing" (or use the seeded one).
2. Command Centre: gross profit this week vs last, orders, contacts, pending approvals, LLM spend against budget, connection health. Everything comes from `engineOrder` and `engineEvent`, not platform numbers.
3. Brand kit: paste the website url and import. The LLM drafts colours, tone, claims and personas; nothing is saved until you press Save, which creates version 2 and an audit entry.
4. Integrations: connect Stripe with a restricted key (or the seeded fake connection), press Sync, watch orders and contacts appear. Connect HubSpot via OAuth if credentials are configured.
5. Audit log: every action above is there with actor, before/after and reasoning.

## Verification

`bun tsc --noEmit` (clean apart from two pre-existing errors in `InboxScreen.tsx` and `KeyboardStickyFooter.native.tsx`), `oxlint --import-plugin` on every engine file, `bun test:unit` (102 files, 672 tests), `bun run scripts/check/openapi-coverage.ts` (only the pre-existing `POST /api/inbox-notices/:id/delete` gap remains), `bun api:manifest` and `bun tko api accept-release` (release 0.1.0), and the seed script against a local Postgres with all migrations applied. The type-aware lint pass (`bun lint`) panics in tsgolint on `no-unnecessary-type-conversion` before this change; the non type-aware pass is clean.

## Findings worth a look outside the engine

- `enterUserDbContext()` is called inside `requireAuth` / `requireApiAuth` after an `await`, and AsyncLocalStorage `enterWith` from an awaited callee does not reach the caller's continuation. Existing routes therefore run their queries with the default bypass context and rely on application filters alone; Postgres RLS only bites for code that binds with `runWithUserDbContextAsync`. Engine routes bind explicitly through `withWorkspaceAccess` / `withEngineAuth`. A one-line fix in `defineRoute` (wrap the handler in `runWithUserDbContextAsync` after auth) would close this for the tax routes too.
- The local docker/orez Postgres user is a superuser, so RLS policies are never exercised locally. Staging is the first place they apply.

## Known gaps

- No invitations for people who have not signed up yet; add member requires an existing user.
- Dashboard incremental profit is null until the experiment service (phase 2) exists.
- HubSpot connector publishes nothing yet (sales channel, sync only). Stripe cost of goods is estimated from product margin rate when the source has none.
- Native app navigation to `/engine` works but screens are laid out for web first.
