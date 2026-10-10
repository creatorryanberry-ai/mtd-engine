#!/usr/bin/env bun

/**
 * @description Write apiRelease.baseline.json from current fingerprint + version
 */

import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { computeApiFingerprint } from '../uncloud/helpers/api-fingerprint'
import { readApiReleaseVersion } from '../uncloud/helpers/api-release-file'

const ROOT = resolve(import.meta.dir, '../..')
const OUT = join(ROOT, 'src/contract/apiRelease.baseline.json')

const fingerprint = computeApiFingerprint(ROOT)
const apiRelease = readApiReleaseVersion(ROOT)

writeFileSync(OUT, `${JSON.stringify({ fingerprint, apiRelease }, null, 2)}\n`)
console.info(`wrote ${OUT}`)
console.info(`fingerprint ${fingerprint.slice(0, 12)}… release ${apiRelease}`)
