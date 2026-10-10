#!/usr/bin/env bun
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildOpenapiSpec } from '~/api/openapi/buildSpec'
import {
  OPENAPI_INFO_DESCRIPTION,
  OPENAPI_SERVERS,
  OPENAPI_TAGS,
} from '~/api/openapi/info'
import '~/api/openapi/load'
import { apiRoutes } from '~/api/registry'
import { API_CONTRACT_VERSION } from '~/contract'

const outPath = resolve(import.meta.dir, '../../src/api/openapi.json')

const spec = buildOpenapiSpec(apiRoutes, {
  contractVersion: API_CONTRACT_VERSION,
  infoDescription: OPENAPI_INFO_DESCRIPTION,
  servers: OPENAPI_SERVERS,
  tags: OPENAPI_TAGS,
})

writeFileSync(outPath, JSON.stringify(spec, null, 2))
console.info(`wrote ${outPath} (${apiRoutes.length} operations)`)
