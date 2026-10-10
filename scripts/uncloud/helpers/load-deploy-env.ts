import { existsSync, readFileSync } from 'node:fs'

import { config as loadDotenv } from '@dotenvx/dotenvx'

export type UncloudEnvTarget = 'production' | 'staging'

export function parseUncloudEnvTarget(
  argv: string[] = process.argv.slice(2),
): UncloudEnvTarget {
  const staging = argv.includes('--staging')
  const production = argv.includes('--production')
  if (staging && production) {
    throw new Error('pass only one of --production or --staging')
  }
  if (staging) return 'staging'
  if (production) return 'production'
  throw new Error(
    'missing target: pass --production or --staging\n' +
      '  e.g. bun tko uncloud deploy-api --production',
  )
}

function envFileKeys(path: string): string[] {
  if (!existsSync(path)) return []
  const keys: string[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_]\w*)\s*=/.exec(line)
    if (match) keys.push(match[1]!)
  }
  return keys
}

/** load env for an uncloud deploy. staging scrub isolates staging from prod-only keys. */
export async function loadUncloudDeployEnv(target: UncloudEnvTarget): Promise<void> {
  if (target === 'production') {
    loadDotenv({ path: '.env' })
    loadDotenv({ path: '.env.production', override: true })
    if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })
    const { loadEnv } = await import('@mtd/scripts/helpers/env-load')
    await loadEnv('production')
    return
  }

  // staging: production MODE + staging VALUES; scrub prod-only keys
  loadDotenv({ path: '.env' })
  loadDotenv({ path: '.env.staging', override: true })
  if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })
  process.env.UNCLOUD_CONTEXT = process.env.UNCLOUD_CONTEXT || 'staging'

  const stagingKeys = new Set([
    ...envFileKeys('.env'),
    ...envFileKeys('.env.staging'),
    ...envFileKeys('.env.local'),
  ])
  const prodOnlyKeys = envFileKeys('.env.production').filter((k) => !stagingKeys.has(k))

  const { loadEnv } = await import('@mtd/scripts/helpers/env-load')
  await loadEnv('production')

  for (const key of prodOnlyKeys) delete process.env[key]

  loadDotenv({ path: '.env.staging', override: true })
  if (existsSync('.env.local')) loadDotenv({ path: '.env.local', override: true })
  process.env.UNCLOUD_CONTEXT = process.env.UNCLOUD_CONTEXT || 'staging'
}
