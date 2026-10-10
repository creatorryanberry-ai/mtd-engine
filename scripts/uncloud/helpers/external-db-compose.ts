import { readFileSync, writeFileSync } from 'node:fs'

/**
 * pgdb is behind the `self-hosted-db` compose profile for local dev, but uncloud
 * validates the entire compose file (including bind mounts) even when that profile
 * is not active. production deploys always use DEPLOY_DB (external managed db),
 * so strip pgdb before `uc deploy`.
 */
export function stripSelfHostedDbFromCompose(composePath: string): void {
  let content = readFileSync(composePath, 'utf-8')
  content = content.replace(/\n  pgdb:[\s\S]*?(?=\n  web:)/, '')
  content = content.replace(/\nvolumes:\n  pgdb_data:\n/, '')
  writeFileSync(composePath, content)
}

/** true when DEPLOY_DB points at an external host rather than the compose pgdb service */
export function usesExternalDatabase(deployDb: string): boolean {
  return !/@pgdb[:/]/.test(deployDb)
}
