import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REL = 'src/contract/apiRelease.ts'

export function apiReleaseFilePath(repoRoot: string): string {
  return join(resolve(repoRoot), REL)
}

export function readApiReleaseVersion(repoRoot: string): string {
  const src = readFileSync(apiReleaseFilePath(repoRoot), 'utf8')
  const match = /export const API_RELEASE_VERSION = '([^']+)'/.exec(src)
  if (!match?.[1]) {
    throw new Error(`could not parse API_RELEASE_VERSION from ${REL}`)
  }
  return match[1]
}

export function writeApiReleaseVersion(repoRoot: string, version: string): void {
  const path = apiReleaseFilePath(repoRoot)
  const next =
    `/** Semver for api/worker image releases. Bump when api-relevant inputs change. */\n` +
    `export const API_RELEASE_VERSION = '${version}'\n`
  writeFileSync(path, next)
  console.info(`updated ${REL} → ${version}`)
  console.info(`commit this file before/with your deploy.`)
}
