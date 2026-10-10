#!/usr/bin/env bun

/**
 * @description Fail if api fingerprint moved without API_RELEASE_VERSION bump
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { compareSemver } from '../uncloud/helpers/api-release-bump'
import { computeApiFingerprint } from '../uncloud/helpers/api-fingerprint'
import { readApiReleaseVersion } from '../uncloud/helpers/api-release-file'

const ROOT = resolve(import.meta.dir, '../..')
const BASELINE = join(ROOT, 'src/contract/apiRelease.baseline.json')

type Baseline = { fingerprint: string; apiRelease: string }

if (!existsSync(BASELINE)) {
  console.error(
    '[check] missing src/contract/apiRelease.baseline.json — run `bun tko api accept-release`',
  )
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline
const fingerprint = computeApiFingerprint(ROOT)
const apiRelease = readApiReleaseVersion(ROOT)

if (fingerprint === baseline.fingerprint) {
  console.info(`[check] api release ok (fingerprint match, release ${apiRelease})`)
  process.exit(0)
}

if (compareSemver(apiRelease, baseline.apiRelease) <= 0) {
  console.error(
    `[check] api inputs changed but API_RELEASE_VERSION (${apiRelease}) is not greater than baseline (${baseline.apiRelease}).\n` +
      `bump src/contract/apiRelease.ts, then run \`bun tko api accept-release\` and commit both.`,
  )
  process.exit(1)
}

console.info(
  `[check] api fingerprint changed and release bumped (${baseline.apiRelease} → ${apiRelease}) — ok\n` +
    `reminder: run \`bun tko api accept-release\` before merge so CI baseline matches.`,
)
