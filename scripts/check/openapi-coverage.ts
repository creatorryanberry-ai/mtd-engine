#!/usr/bin/env bun
// run: bun run ./scripts/check/openapi-coverage.ts

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildOpenapiSpec } from '~/api/openapi/buildSpec'
import {
  diffManifestCoverage,
  parseManifestOpsFromSource,
  type ManifestOp,
} from '~/api/openapi/coverage'
import {
  OPENAPI_INFO_DESCRIPTION,
  OPENAPI_SERVERS,
  OPENAPI_TAGS,
} from '~/api/openapi/info'
import '~/api/openapi/load'
import { apiRoutes } from '~/api/registry'
import { API_CONTRACT_VERSION } from '~/contract'

// parse routeManifest.generated.ts as text — importing it executes handler modules
// that transitively load `server-only`, which throws under plain `bun run`.
function manifestOpsFromGenerated(): ManifestOp[] {
  const source = readFileSync(
    resolve(import.meta.dir, '../../src/server/routeManifest.generated.ts'),
    'utf8',
  )
  return parseManifestOpsFromSource(source)
}

const PHANTOM_FILE_METHODS = ['GET', 'PATCH', 'PUT', 'DELETE'] as const
const PHANTOM_FILE_PATHS = ['/api/file/receipt', '/api/file/upload'] as const

const allowlist: ManifestOp[] = PHANTOM_FILE_PATHS.flatMap((pattern) =>
  PHANTOM_FILE_METHODS.map((method) => ({ method, pattern })),
)

const spec = buildOpenapiSpec(apiRoutes, {
  contractVersion: API_CONTRACT_VERSION,
  infoDescription: OPENAPI_INFO_DESCRIPTION,
  servers: OPENAPI_SERVERS,
  tags: OPENAPI_TAGS,
})

const openapiPaths = spec.paths as Record<string, Record<string, unknown>>
const manifest = manifestOpsFromGenerated()
const { missing } = diffManifestCoverage({ manifest, openapiPaths, allowlist })

if (missing.length === 0) {
  console.info('[check] openapi manifest coverage ok')
  process.exit(0)
}

console.error('[check] manifest operations missing from openapi:')
for (const op of missing) {
  console.error(`  ${op.method} ${op.pattern}`)
}
process.exit(1)
