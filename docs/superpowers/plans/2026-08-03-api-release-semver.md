# API Release Semver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `API_RELEASE_VERSION` + fingerprint skip-deploy, interactive bump prompt (default patch), and CI baseline enforcement; keep `API_CONTRACT_VERSION` for breaking changes.

**Architecture:** Hash api-relevant paths; compare to `.mtd/api-deploy/<target>.json` and optional live health; skip or prompt/bump before `runUncloudDeploy`; CI compares fingerprint to committed baseline.

**Tech Stack:** Bun, existing uncloud deploy scripts, vitest, `bun check` auto-discovery.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-03-api-release-semver-design.md`
- OpenAPI `info.version` stays tied to `API_CONTRACT_VERSION` only
- `.mtd/` gitignored; baseline committed
- Non-interactive fails if bump required without `--bump`
- `console.info`; few lowercase comments; Conventional Commits if committing

---

### Task 1: Release version + fingerprint helpers (+ tests)

**Files:**
- Create: `src/contract/apiRelease.ts`
- Create: `scripts/uncloud/helpers/api-fingerprint.ts`
- Create: `scripts/uncloud/helpers/api-release-bump.ts`
- Create: `scripts/uncloud/helpers/api-fingerprint.test.ts`
- Create: `scripts/uncloud/helpers/api-release-bump.test.ts`

- [x] Implement `API_RELEASE_VERSION = '0.0.0'`
- [x] Implement fingerprint path list + deterministic hash
- [x] Implement bump/compare/parse + prompt helper (testable pure bump)

---

### Task 2: Deploy state + prepare-api-deploy gate

**Files:**
- Create: `scripts/uncloud/helpers/api-deploy-state.ts`
- Create: `scripts/uncloud/helpers/prepare-api-deploy.ts`
- Modify: `scripts/uncloud/deploy-api.ts`
- Modify: `.gitignore` → `.mtd/`

- [x] Read/write `.mtd/api-deploy/<target>.json`
- [x] Skip / prompt / `--bump` / `--force` / `--non-interactive`
- [x] Write state after successful deploy

---

### Task 3: Health fields + CI baseline

**Files:**
- Modify: `app/api/health+api.ts`
- Create: `src/contract/apiRelease.baseline.json`
- Create: `scripts/check/api-release.ts`
- Create: `scripts/api/accept-release.ts`

- [x] Health returns `apiRelease` + `apiContract`
- [x] Check fails when fingerprint moved without version gt baseline
- [x] `bun tko api accept-release` writes baseline from current tree

---

### Task 4: Docs + verify

- Update native-release / staging skill notes briefly
- Run unit tests for helpers + `bun test:unit` on new files
