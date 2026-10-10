#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

await cmd`Clean up local OrbStack VM`.run(async () => {
  const { execSync } = await import('node:child_process')

  const VM_NAME = 'mtd-deploy'

  try {
    console.info('cleaning up orbstack vm...\n')
    execSync(`orbctl delete ${VM_NAME}`, { stdio: 'inherit' })
    console.info('\n✅ vm cleaned up')
  } catch (error) {
    console.error('failed to clean up vm')
    process.exit(1)
  }
})
