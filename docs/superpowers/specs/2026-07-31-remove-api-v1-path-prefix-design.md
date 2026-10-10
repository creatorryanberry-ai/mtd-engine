# Remove `/api/v1` path prefix

## Goal

Ship one canonical HTTP API under `/api/*` with no URL version segment. Versioning for the future is `apiContract` (numeric) via handshake, not a path prefix. The app is pre-launch; hard break for developers is fine. Leave no unused leftover files after the move.

## Decisions

| Decision | Choice |
|----------|--------|
| Path scheme | Drop `/v1` from all live URLs |
| Compatibility | Hard cutover — no redirects or `/api/v1` aliases |
| Path collisions | Merge methods onto one path where methods differ |
| Quarterly enqueue vs sync POST | Sync stays at `POST /api/submissions/quarterly`; enqueue moves to `POST /api/submissions/quarterly/jobs` |
| Implementation style | Move route files so disk layout matches URLs |
| Unused endpoints (no app caller yet) | Keep on new paths (handshake, `GET /api/transactions`, enqueue jobs) |
| Residual `v1` naming | Scrub — rename OpenAPI snapshot, drop `API_VERSION_PREFIX`, no `v1.` in `info.version` |
| `apiContract` | Do not bump for this path-only change |
| Rewrite all ad-hoc handlers to `defineRoute` | Out of scope |

## Current state

- Contract-style routes live under `app/api/v1/**/*+api.ts` and register as `/api/v1/...`.
- Shared handshake/events logic: `src/api/v1/handshake.ts`.
- Older product routes already use unversioned `/api/...` (auth, Plaid, HMRC, sync quarterly submit, transaction patch/approve/manual, etc.).
- App clients call several `/api/v1/*` paths (user, notifications, devices, events). Handshake, `GET` transactions list, and enqueue quarterly are unused by the app today.
- OpenAPI snapshot: `src/api/openapi-v1.json`; Scalar (`api-docs/`) still labels sidebar entries as `v1` vs `legacy`.
- `API_CONTRACT_VERSION` in `src/contract/version.ts` is independent of the URL segment. `API_VERSION_PREFIX = 'v1'` is unused for routing (paths are hardcoded).

## Target paths

| From | To |
|------|-----|
| `GET /api/v1/handshake` | `GET /api/handshake` |
| `GET /api/v1/events` | `GET /api/events` |
| `GET` / `PATCH /api/v1/users/me` | `/api/users/me` |
| `GET /api/v1/users/username-available` | `/api/users/username-available` |
| `GET` / `PATCH /api/v1/users/business-settings` | `/api/users/business-settings` |
| `GET /api/v1/notifications` | `/api/notifications` |
| `PATCH /api/v1/notifications/:id` | `/api/notifications/:id` |
| `PUT /api/v1/devices` | `/api/devices` |
| `GET /api/v1/transactions` | `GET /api/transactions` (alongside existing `PATCH /api/transactions`) |
| `POST /api/v1/submissions/quarterly` (enqueue) | `POST /api/submissions/quarterly/jobs` |
| Existing sync `POST` / `DELETE /api/submissions/quarterly` | unchanged |

Request/response shapes stay the same except for the path change (and the enqueue path rename).

## Server layout

1. Move `app/api/v1/{handshake,events,devices,notifications,users}/**` → `app/api/...` (same relative structure under `/api`).
2. Fold `GET` from `app/api/v1/transactions+api.ts` into existing `app/api/transactions+api.ts` (keep `PATCH`). Delete the v1 transactions file.
3. Move enqueue handler to `app/api/submissions/quarterly/jobs+api.ts`. Leave sync/delete on `app/api/submissions/quarterly+api.ts`.
4. Move `src/api/v1/handshake.ts` → `src/api/handshake.ts`; update path string and imports.
5. Delete empty `app/api/v1` and `src/api/v1` directories — no orphan stubs.
6. Regenerate `src/server/routeManifest.generated.ts` (`bun run api:manifest`).

## Clients

Update string paths in:

- `src/features/user/useUser.ts`
- `src/features/user/useProfileEdit.ts`
- `src/features/business/useBusinessSettings.ts`
- `src/features/notification/useNotifications.ts`
- `src/interface/notification/NotificationList.tsx`
- `src/features/notification/registerDevice.native.ts`
- `src/features/api/client/ProvideQuery.tsx` (EventSource → `/api/events`)
- `src/test/integration/helpers.ts` (`completeBusinessSetup`)

No new client wiring for handshake, `GET /api/transactions`, or enqueue jobs in this change.

## OpenAPI, docs UI, naming cleanup

1. Update path strings in OpenAPI registrations (including quarterly jobs path). Rename `src/api/openapi/v1.ts` → `src/api/openapi/core.ts` and update the manifest import; update `src/api/openapi/events.ts` paths. Do not leave a unused `v1.ts`.
2. Rename committed snapshot `src/api/openapi-v1.json` → `src/api/openapi.json` (`git mv`). Update `scripts/docs/gen-openapi.ts`, `api-docs` import, and any other references.
3. Remove `API_VERSION_PREFIX` from `src/contract/version.ts` (and any imports) once nothing references it.
4. Set OpenAPI `info.version` to `${contractVersion}` (no `v1.` prefix).
5. Rewrite `OPENAPI_INFO_DESCRIPTION`: single `/api/*` surface; versioning = `apiContract` from `GET /api/handshake` + `x-app-version` / `appVersion` query. Drop v1-vs-legacy product framing.
6. Simplify `api-docs/main.ts`: remove `v1` / `legacy` sidebar kinds and dual-prefix logic; one `/api` tree. Keep existing UX polish (slash labels, method badges, path grouping) adapted to the single tree.
7. Update docs curls / prose (`docs/staging.md`, `docs/api-service.md`, and any other `/api/v1` references).

## Future versioning

- **Now:** unversioned `/api/*`; incompatible shape changes bump `API_CONTRACT_VERSION` and are signaled via handshake.
- **Later (out of scope):** if URL versioning is needed again, introduce an explicit new prefix (e.g. `/api/v2`) as a deliberate breaking step — do not reintroduce a half-used `/v1` for today’s surface.

## Testing & verification

- Update unit fixtures that hardcode `/api/v1` (`src/test/unit/apiRouter.test.ts`, `src/test/unit/openapiBuildSpec.test.ts`).
- Integration helper path update (above).
- Regenerate OpenAPI snapshot; ensure Scalar builds against the new file.
- `bun check` after changes.

## Out of scope

- Redirects or dual registration of old `/api/v1/*` paths.
- Bumping `apiContract` solely for path moves.
- Migrating the app from sync quarterly submit to the job enqueue flow.
- Rewriting every older ad-hoc `/api/*` handler onto `defineRoute` / Valibot contract style.
- Handshake force-upgrade UX beyond existing classify/status plumbing.
- Production client compatibility (pre-launch; only developers affected).

## Success criteria

- No route, client fetch, OpenAPI path, or docs curl still uses `/api/v1`.
- No leftover unused files or empty `v1` directories from this migration.
- `GET` + `PATCH` share `/api/transactions`; sync and enqueue quarterly use distinct paths as above.
- Manifest + OpenAPI snapshot regenerated and checked in.
- `bun check` passes.
