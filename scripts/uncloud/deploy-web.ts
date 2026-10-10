#!/usr/bin/env bun

import { assertDeployEnv } from './helpers/assert-deploy-env'
import { assertProdAuthFlags } from './helpers/assert-prod-auth-flags'
import { runUncloudDeploy } from './helpers/deploy-core'
import { loadUncloudDeployEnv, parseUncloudEnvTarget } from './helpers/load-deploy-env'

const target = parseUncloudEnvTarget()
await loadUncloudDeployEnv(target)
assertDeployEnv('web')
if (target === 'production') {
  assertProdAuthFlags()
}

// web is independent of api+worker — do not include them here
await runUncloudDeploy({ name: target, services: ['web'] })
