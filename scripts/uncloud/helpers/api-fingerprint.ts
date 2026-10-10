import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** paths (relative to repo root) that affect the api/worker image contents */
export const API_FINGERPRINT_PATHS = [
  'Dockerfile',
  'package.json',
  'bun.lock',
  'src/uncloud/docker-compose.yml',
  'src/server',
  'app/api',
  'src/api',
  'src/contract',
  'src/jobs',
  'src/database',
  'src/env.ts',
  'packages/database',
  'packages/helpers',
  'packages/env',
  'api-docs',
  'scripts/docs',
] as const

function walkFiles(absDir: string, root: string, out: string[]) {
  if (!existsSync(absDir)) return
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue
    }
    const abs = join(absDir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(abs, root, out)
      continue
    }
    if (entry.isFile()) {
      const rel = relative(root, abs).split('\\').join('/')
      // baseline is derived from the fingerprint — exclude or it never stabilizes
      if (rel === 'src/contract/apiRelease.baseline.json') continue
      out.push(rel)
    }
  }
}

/** sorted relative file paths included in the fingerprint */
export function listApiFingerprintFiles(repoRoot: string): string[] {
  const root = resolve(repoRoot)
  const files: string[] = []
  for (const entry of API_FINGERPRINT_PATHS) {
    const abs = join(root, entry)
    if (!existsSync(abs)) continue
    const st = statSync(abs)
    if (st.isDirectory()) {
      walkFiles(abs, root, files)
    } else if (st.isFile()) {
      files.push(entry)
    }
  }
  return [...new Set(files)].sort()
}

export function computeApiFingerprint(repoRoot: string): string {
  const root = resolve(repoRoot)
  const hash = createHash('sha256')
  for (const rel of listApiFingerprintFiles(root)) {
    hash.update(rel)
    hash.update('\0')
    hash.update(readFileSync(join(root, rel)))
    hash.update('\0')
  }
  return hash.digest('hex')
}
