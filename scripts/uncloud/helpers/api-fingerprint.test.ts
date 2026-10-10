import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { computeApiFingerprint, listApiFingerprintFiles } from './api-fingerprint'

function makeTree() {
  const root = mkdtempSync(join(tmpdir(), 'api-fp-'))
  writeFileSync(join(root, 'Dockerfile'), 'FROM bun\n')
  writeFileSync(join(root, 'package.json'), '{"name":"x"}\n')
  writeFileSync(join(root, 'bun.lock'), '# lock\n')
  mkdirSync(join(root, 'src/contract'), { recursive: true })
  writeFileSync(
    join(root, 'src/contract/apiRelease.ts'),
    "export const API_RELEASE_VERSION = '0.0.0'\n",
  )
  return root
}

describe('api fingerprint', () => {
  it('is deterministic for the same tree', () => {
    const root = makeTree()
    const a = computeApiFingerprint(root)
    const b = computeApiFingerprint(root)
    expect(a).toBe(b)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes when a fingerprinted file changes', () => {
    const root = makeTree()
    const before = computeApiFingerprint(root)
    writeFileSync(join(root, 'Dockerfile'), 'FROM bun\n# change\n')
    const after = computeApiFingerprint(root)
    expect(after).not.toBe(before)
  })

  it('lists sorted relative paths', () => {
    const root = makeTree()
    const files = listApiFingerprintFiles(root)
    expect(files).toEqual([...files].sort())
    expect(files).toContain('Dockerfile')
    expect(files).toContain('src/contract/apiRelease.ts')
  })
})
