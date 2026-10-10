---
name: api-release-semver
description: API release semver + fingerprint skip-deploy; keep apiContract for breaking changes; interactive bump prompt on deploy.
---

# API release semver + skip-unchanged deploy

## Goal

1. **Release semver** for the api/worker image — identity, health, and “did this ship?”
2. **Skip api deploy** when api-relevant inputs are unchanged (release / `deploy-api`).
3. **Contract gate** stays integer `apiContract` for incompatible client shapes.
4. **Ensure version moves when api moves** — CI fails if api fingerprint inputs change without a release bump; deploy interactively offers a bump (default **patch**) when a bump is needed.

## Non-goals

- URL path versioning (`/api/v2`) — still reserved; out of scope
- Auto-bumping major/minor without a human choice
- Skipping worker-only vs api-only as separate images (same `mtd-web:latest` image today)
- Full OpenAPI breaking-diff CI in this spec’s minimal slice (called out as follow-up; contract bump remains manual/disciplined until that lands)

## Two version fields

| Field | Type | Where | When to bump |
|--------|------|--------|----------------|
| `API_RELEASE_VERSION` | semver string e.g. `1.0.0` | `src/contract/apiRelease.ts` (new) | Any intentional api/worker/docs image change |
| `API_CONTRACT_VERSION` | integer (existing) | `src/contract/version.ts` | Incompatible request/response shape changes only |

OpenAPI `info.version` stays tied to **contract** (`String(API_CONTRACT_VERSION)`), not release semver — clients care about contract, not deploy count.

Health (and optionally handshake later) expose:

```ts
{ status, sha, env, apiRelease, apiContract, timestamp }
```

## Fingerprint (“has the api changed?”)

### Inputs (hashed)

Stable relative paths from repo root, sorted, content-hashed (sha256 of file bytes + path). Include:

- `Dockerfile`
- `src/uncloud/docker-compose.yml` (api/worker service definitions)
- `src/server/**` (api entry, router, generated manifest)
- `app/api/**`
- `src/api/**`
- `src/contract/**`
- `src/jobs/**` (worker in same image)
- `src/database/**` (migrations run at deploy)
- `src/env.ts`
- `packages/database/**`, `packages/helpers/**`, `packages/env/**` (server runtime deps commonly pulled by api)
- `api-docs/**`, `scripts/docs/**` (docs baked into api image)
- `package.json` / `bun.lock` (dependency changes affect the image)

Exclude generated noise that is rebuilt in Docker from the same sources if redundant (e.g. `src/server/routeManifest.generated.ts` if always regenerated from `app/api` in build — prefer hashing sources; if manifest is committed and can drift, include it).

Exact list lives in one module e.g. `scripts/uncloud/helpers/api-fingerprint.ts` with a unit test that the helper is deterministic.

### State: last deployed fingerprint

Per target (`staging` | `production`), store after a successful deploy:

```json
{
  "fingerprint": "<hex>",
  "apiRelease": "1.0.1",
  "gitSha": "<sha>",
  "deployedAt": "<iso>"
}
```

Location: **gitignored** local cache under `.mtd/api-deploy/<target>.json` (developer machine / CI workspace). Not the source of truth for “what’s live” — that’s health — but enough to skip redundant deploys from the same laptop/CI job history.

**Also compare to live** when reachable: `GET /api/health` → if `apiRelease` + optional fingerprint header/field matches current, skip. Prefer:

1. Compute local fingerprint + read `API_RELEASE_VERSION`
2. Fetch live health (staging-api / api host from deploy env)
3. Skip if live `apiRelease` equals local **and** local fingerprint equals last-deployed fingerprint for that target  
   - If fingerprint changed but version didn’t → **must bump** (prompt or fail)
   - If version bumped but fingerprint same → still deploy (explicit release) unless both match live

Simpler skip rule for v1:

```
skip iff fingerprint == lastDeployed.fingerprint for this target
         OR (live.apiRelease == local.API_RELEASE_VERSION && fingerprint == lastDeployed.fingerprint)
```

If no state file and health unreachable → **do not skip** (safe default).

## Interactive bump prompt

When `deploy-api` (or release’s api step) detects **fingerprint changed** vs last-deployed state (or no state and health `apiRelease` ≠ local / missing):

1. If `API_RELEASE_VERSION` already differs from last-deployed / live release **and** fingerprint changed → proceed (human already bumped).
2. If fingerprint changed **and** version equals last-deployed/live → **prompt**:

```
api inputs changed since last deploy (staging).
current API_RELEASE_VERSION: 1.0.0
bump? [patch] / minor / major / <x.y.z> / skip
>
```

- Default (Enter) → **patch** (`1.0.0` → `1.0.1`)
- `minor` / `major` → bump that component, zero lower
- `x.y.z` → set exact (must be > current by semver compare)
- `skip` → abort deploy with non-zero (do not ship without version move), unless `--allow-same-version` escape hatch for emergencies

3. Write updated `API_RELEASE_VERSION` into `src/contract/apiRelease.ts` (or shared constant file).
4. Remind to commit the bump (print path); optionally `git add` that file only if `--commit-version` later — **out of scope for v1** (print only).

Non-interactive (CI / `CI=1` / `--non-interactive`):

- Fingerprint changed and version not bumped → **fail** with message to bump locally or pass version flag
- Support `--bump patch|minor|major` for scripted bumps without TTY

Flags on `deploy-api`:

| Flag | Behavior |
|------|----------|
| `--force` | Deploy even if fingerprint unchanged |
| `--skip-unchanged` | Default **on**; `--no-skip-unchanged` to always build |
| `--bump patch\|minor\|major` | Non-interactive bump when needed |
| `--non-interactive` | No prompts; fail if bump required without `--bump` |

Release script: inherit the same deploy-api behavior (no separate prompt layer). `--skip-api` still skips entirely.

## CI enforcement

New check script e.g. `scripts/check/api-release.ts` (auto-picked by `bun check`):

1. Compute fingerprint of api inputs (same helper).
2. Load committed `API_RELEASE_VERSION`.
3. Compare against a **committed baseline** file `src/contract/apiRelease.baseline.json`:

```json
{ "fingerprint": "<hex>", "apiRelease": "0.0.0" }
```

4. Rules:
   - If fingerprint == baseline.fingerprint → ok (version may stay).
   - If fingerprint ≠ baseline.fingerprint → require `apiRelease` > baseline.apiRelease (semver gt).
   - On success after intentional bump, developer/PR updates baseline fingerprint + version together (or a small `bun tko api accept-release` writes baseline from current tree).

Workflow for a PR that changes api code:

1. Change code  
2. Run deploy or `bun tko api bump` → prompt/default patch → updates `apiRelease.ts`  
3. Run `bun tko api accept-release` (or check suggests it) → updates baseline  
4. Commit both  

Contract: existing discipline — bump `API_CONTRACT_VERSION` on breaking shapes. Follow-up: OpenAPI snapshot breaking-diff CI (from `2026-07-17-api-versioning-guard` plan); not blocking this design.

## Deploy flow (updated)

```
deploy-api --staging|--production
  → fingerprint
  → load state + optional health
  → if unchanged && !force → exit 0 ("api unchanged, skip")
  → if changed && version not bumped → prompt / --bump / fail
  → write version file if bumped
  → existing build/push/migrate/recreate
  → write .mtd/api-deploy/<target>.json
```

## File sketch

| Path | Role |
|------|------|
| `src/contract/apiRelease.ts` | `export const API_RELEASE_VERSION = '0.0.0'` |
| `src/contract/apiRelease.baseline.json` | CI baseline fingerprint + version |
| `scripts/uncloud/helpers/api-fingerprint.ts` | path list + hash |
| `scripts/uncloud/helpers/api-release-bump.ts` | semver bump + prompt |
| `scripts/uncloud/helpers/api-deploy-state.ts` | read/write `.mtd/api-deploy/` |
| `scripts/check/api-release.ts` | CI gate |
| `scripts/api/bump.ts` / `accept-release.ts` | tko helpers |
| `app/api/health+api.ts` | add `apiRelease`, `apiContract` |
| `scripts/uncloud/deploy-api.ts` + `deploy-core` | skip + bump wiring |
| `.gitignore` | `.mtd/` |

## Success criteria

- Second `bun tko release preview` with no api-path changes skips api deploy (logs clearly).
- Changing an api route without bumping release version fails `bun check` (baseline) and fails non-interactive deploy.
- Interactive deploy offers patch by default and updates `API_RELEASE_VERSION`.
- Health returns `apiRelease` + `apiContract`.
- Breaking contract still uses integer `API_CONTRACT_VERSION` only.

## Follow-ups

- OpenAPI additive/breaking CI tied to `API_CONTRACT_VERSION`
- Tag docker images `mtd-web:1.0.1` in addition to `:latest`
- Commit version bump automatically with a release trailer
