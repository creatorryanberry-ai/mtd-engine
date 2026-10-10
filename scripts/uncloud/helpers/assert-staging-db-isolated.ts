import { existsSync, readFileSync } from 'node:fs'

/** committed fallback if .env.production is absent (ci / fresh checkout) */
export const KNOWN_PRODUCTION_DB_HOSTS = ['34.13.41.244'] as const

export function parsePostgresHost(url: string): string | null {
  if (!url) return null
  try {
    const normalized = url
      .replace(/^postgresql:/i, 'http:')
      .replace(/^postgres:/i, 'http:')
    const host = new URL(normalized).hostname
    return host || null
  } catch {
    const match = url.match(/@([^:/?]+)/)
    return match?.[1] || null
  }
}

export function readDeployDbHostFromEnvFile(path: string): string | null {
  if (!existsSync(path)) return null
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*(DEPLOY_DB|DATABASE_URL)\s*=\s*(.+?)\s*$/.exec(line)
    if (!match) continue
    let value = match[2]!
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    const host = parsePostgresHost(value)
    if (host) return host
  }
  return null
}

export function collectForbiddenProductionDbHosts(options?: {
  productionEnvPath?: string
  knownHosts?: readonly string[]
}): string[] {
  const productionEnvPath = options?.productionEnvPath ?? '.env.production'
  const knownHosts = options?.knownHosts ?? KNOWN_PRODUCTION_DB_HOSTS
  const hosts = new Set<string>(knownHosts)
  const fromFile = readDeployDbHostFromEnvFile(productionEnvPath)
  if (fromFile) hosts.add(fromFile)
  return [...hosts]
}

export function assertStagingDbIsolated(options: {
  stagingDbUrl: string
  productionEnvPath?: string
  knownHosts?: readonly string[]
}): void {
  const stagingHost = parsePostgresHost(options.stagingDbUrl)
  if (!stagingHost) {
    throw new Error(
      'staging DEPLOY_DB/DATABASE_URL is missing or has no host\n' +
        'set DEPLOY_DB in .env.staging to a dedicated managed postgres instance',
    )
  }

  const forbidden = collectForbiddenProductionDbHosts({
    productionEnvPath: options.productionEnvPath,
    knownHosts: options.knownHosts,
  })

  if (forbidden.includes(stagingHost)) {
    throw new Error(
      `staging must not use the production postgres host (${stagingHost})\n` +
        'point DEPLOY_DB / DATABASE_URL in .env.staging at a separate managed instance',
    )
  }
}
