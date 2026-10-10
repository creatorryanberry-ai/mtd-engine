import { describe, expect, it } from 'vitest'

import { findDuplicateCharacterClassChars } from './duplicateCharacterClass'

describe('findDuplicateCharacterClassChars', () => {
  it('flags a repeated middle dot in a bullet class', () => {
    const source = String.raw`.replace(/^\s*[•●▪◦‣·∙*·\-–—]+\s*/u, '')`
    const findings = findDuplicateCharacterClassChars(source, 'x.ts')
    expect(findings).toEqual([
      expect.objectContaining({ path: 'x.ts', char: '·', line: 1 }),
    ])
  })

  it('accepts the same class with one middle dot', () => {
    const source = String.raw`.replace(/^\s*[•●▪◦‣·∙*\-–—]+\s*/u, '')`
    expect(findDuplicateCharacterClassChars(source, 'x.ts')).toEqual([])
  })

  it('ignores ranges and escaped hyphens', () => {
    const source = String.raw`const re = /[a-z0-9_\-]+/i`
    expect(findDuplicateCharacterClassChars(source, 'x.ts')).toEqual([])
  })

  it('ignores character classes inside strings', () => {
    const source = `const text = '[••]'`
    expect(findDuplicateCharacterClassChars(source, 'x.ts')).toEqual([])
  })

  it('ignores division slashes', () => {
    const source = 'const ratio = width / height'
    expect(findDuplicateCharacterClassChars(source, 'x.ts')).toEqual([])
  })
})
