import { describe, expect, it } from 'vitest'

import {
  bumpSemver,
  compareSemver,
  parseSemver,
  promptApiReleaseBump,
  resolveBumpChoice,
} from './api-release-bump'

describe('parseSemver / compareSemver / bumpSemver', () => {
  it('parses x.y.z', () => {
    expect(parseSemver('1.2.3')).toEqual([1, 2, 3])
  })

  it('compares versions', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBeLessThan(0)
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
  })

  it('bumps patch/minor/major', () => {
    expect(bumpSemver('1.2.3', 'patch')).toBe('1.2.4')
    expect(bumpSemver('1.2.3', 'minor')).toBe('1.3.0')
    expect(bumpSemver('1.2.3', 'major')).toBe('2.0.0')
  })
})

describe('resolveBumpChoice', () => {
  it('defaults empty and patch to patch bump', () => {
    expect(resolveBumpChoice('1.0.0', '')).toBe('1.0.1')
    expect(resolveBumpChoice('1.0.0', 'patch')).toBe('1.0.1')
  })

  it('handles minor/major/skip/exact', () => {
    expect(resolveBumpChoice('1.0.0', 'minor')).toBe('1.1.0')
    expect(resolveBumpChoice('1.0.0', 'major')).toBe('2.0.0')
    expect(resolveBumpChoice('1.0.0', 'skip')).toBe('skip')
    expect(resolveBumpChoice('1.0.0', '1.0.5')).toBe('1.0.5')
  })

  it('rejects exact <= current', () => {
    expect(() => resolveBumpChoice('1.0.1', '1.0.1')).toThrow(/greater/)
    expect(() => resolveBumpChoice('1.0.1', '1.0.0')).toThrow(/greater/)
  })
})

describe('promptApiReleaseBump', () => {
  it('applies default patch on empty enter', async () => {
    const next = await promptApiReleaseBump('1.0.0', {
      readLine: async () => '\n',
    })
    expect(next).toBe('1.0.1')
  })

  it('aborts on skip', async () => {
    await expect(
      promptApiReleaseBump('1.0.0', { readLine: async () => 'skip\n' }),
    ).rejects.toThrow(/aborted/)
  })
})
