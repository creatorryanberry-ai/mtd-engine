#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

import { requiredDeployEnvKeys } from '../uncloud/helpers/assert-deploy-env'

await cmd`Validate production secrets for deploy`
  .args('--web boolean')
  .run(async ({ args }) => {
    const kind = args.web ? 'web' : 'api'
    const required = requiredDeployEnvKeys(kind)
    const missing = required.filter((key) => {
      if (key === 'DATABASE_URL') {
        return !process.env.DATABASE_URL && !process.env.DEPLOY_DB
      }
      return !process.env[key]
    })

    if (missing.length === 0) {
      console.info(`all required ${kind} deploy secrets present`)
      return
    }

    console.error(`missing github secrets required for ${kind} deploy:`)
    for (const key of missing) {
      console.error(`  - ${key}`)
    }
    console.error('')
    console.error('sync from .env.production:')
    console.error('  bun scripts/env/sync-to-github.ts --yes')
    process.exit(1)
  })
