#!/usr/bin/env bun

/** required env keys per uncloud deploy kind (api vs web). */

export type DeployEnvKind = 'api' | 'web'

const API_KEYS = [
  'API_SERVER_URL',
  'VITE_API_HOSTNAME',
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'DEPLOY_HOST',
  'DEPLOY_SSH_KEY',
  'VITE_PROTOCOL',
] as const

const WEB_KEYS = [
  'ONE_SERVER_URL',
  'VITE_WEB_HOSTNAME',
  'DEPLOY_HOST',
  'DEPLOY_SSH_KEY',
  'VITE_PROTOCOL',
] as const

function present(key: string): boolean {
  const value = process.env[key]
  return value !== undefined && value !== ''
}

function hasDatabase(): boolean {
  return present('DATABASE_URL') || present('DEPLOY_DB')
}

/** throw if process.env is missing keys for this deploy kind. */
export function assertDeployEnv(kind: DeployEnvKind): void {
  const required = kind === 'api' ? API_KEYS : WEB_KEYS
  const missing: string[] = required.filter((key) => !present(key))
  if (kind === 'api' && !hasDatabase()) {
    missing.push('DATABASE_URL|DEPLOY_DB')
  }
  if (missing.length === 0) return

  const label = kind === 'api' ? 'deploy-api' : 'deploy-web'
  throw new Error(
    `missing env for ${label}:\n` +
      missing.map((k) => `  - ${k}`).join('\n') +
      `\nfill .env.production / .env.staging (and re-run).`,
  )
}

export function requiredDeployEnvKeys(kind: DeployEnvKind): readonly string[] {
  if (kind === 'api') {
    return [...API_KEYS, 'DATABASE_URL']
  }
  return WEB_KEYS
}
