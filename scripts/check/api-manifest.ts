#!/usr/bin/env bun

import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dir, '../..')
const OUT = join(ROOT, 'src/server/routeManifest.generated.ts')

const before = readFileSync(OUT, 'utf8')
await import('../api/gen-route-manifest.ts')
const after = readFileSync(OUT, 'utf8')

if (before !== after) {
  console.error(
    '[check] route manifest is stale. run `bun run api:manifest` and commit the result.',
  )
  process.exit(1)
}
console.info('[check] route manifest up to date')
