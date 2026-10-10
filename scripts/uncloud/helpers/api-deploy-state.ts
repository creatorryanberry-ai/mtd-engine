import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type ApiDeployState = {
  fingerprint: string
  apiRelease: string
  gitSha: string
  deployedAt: string
}

export function apiDeployStatePath(
  repoRoot: string,
  target: 'staging' | 'production',
): string {
  return join(resolve(repoRoot), '.mtd', 'api-deploy', `${target}.json`)
}

export function readApiDeployState(
  repoRoot: string,
  target: 'staging' | 'production',
): ApiDeployState | null {
  const path = apiDeployStatePath(repoRoot, target)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as ApiDeployState
  } catch {
    return null
  }
}

export function writeApiDeployState(
  repoRoot: string,
  target: 'staging' | 'production',
  state: ApiDeployState,
): void {
  const path = apiDeployStatePath(repoRoot, target)
  mkdirSync(join(resolve(repoRoot), '.mtd', 'api-deploy'), { recursive: true })
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`)
}
