import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readSrc(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8')
}

describe('backend scripts', () => {
  it('starts OrbStack or Docker Desktop when the daemon is down', () => {
    const backend = readSrc('scripts/backend.ts')
    const clean = readSrc('scripts/backend-clean.ts')

    expect(backend).toMatch(/ensureDockerDaemon/)
    expect(backend).toMatch(/docker compose up/)
    expect(clean).toMatch(/ensureDockerDaemon/)
    expect(clean).toMatch(/docker compose down/)
  })
})
