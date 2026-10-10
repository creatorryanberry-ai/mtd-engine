#!/usr/bin/env bun

import { resolve } from 'node:path'

import { assertDeployEnv } from './helpers/assert-deploy-env'
import { assertProdAuthFlags } from './helpers/assert-prod-auth-flags'
import { assertStagingDbIsolated } from './helpers/assert-staging-db-isolated'
import { runUncloudDeploy } from './helpers/deploy-core'
import { loadUncloudDeployEnv, parseUncloudEnvTarget } from './helpers/load-deploy-env'
import { prepareApiDeploy, recordApiDeploySuccess } from './helpers/prepare-api-deploy'

const target = parseUncloudEnvTarget()
await loadUncloudDeployEnv(target)
assertDeployEnv('api')
if (target === 'production') {
  assertProdAuthFlags()
}

if (target === 'staging') {
  const stagingDbUrl = process.env.DEPLOY_DB || process.env.DATABASE_URL || ''
  assertStagingDbIsolated({ stagingDbUrl })
}

const repoRoot = resolve(import.meta.dir, '../..')
const prepared = await prepareApiDeploy({
  repoRoot,
  target,
  argv: process.argv.slice(2),
})
if (prepared.action === 'skip') {
  process.exit(0)
}

// default backend ship: api + worker (web is deploy-web)
await runUncloudDeploy({ name: target, services: ['api', 'worker'] })

recordApiDeploySuccess({
  repoRoot,
  target,
  fingerprint: prepared.fingerprint,
  apiRelease: prepared.apiRelease,
  gitSha: process.env.GIT_SHA || 'unknown',
})
