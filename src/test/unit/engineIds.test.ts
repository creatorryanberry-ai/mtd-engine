import { describe, expect, it } from 'vitest'

import { hashBucket, newId, normalizeEmail, slugify } from '~/features/engine/core/ids'

describe('newId', () => {
  it('prefixes a hex uuid without dashes', () => {
    const id = newId('ws')
    expect(id).toMatch(/^ws_[0-9a-f]{32}$/)
    expect(newId('ws')).not.toBe(id)
  })
})

describe('hashBucket', () => {
  it('is deterministic for the same value and salt', () => {
    expect(hashBucket('alice@example.com', 'ws_1')).toBe(
      hashBucket('alice@example.com', 'ws_1'),
    )
  })

  it('changes with the salt', () => {
    expect(hashBucket('alice@example.com', 'ws_1')).not.toBe(
      hashBucket('alice@example.com', 'ws_2'),
    )
  })

  it('stays within 0..9999', () => {
    for (let i = 0; i < 500; i++) {
      const bucket = hashBucket(`contact-${i}`, 'salt')
      expect(Number.isInteger(bucket)).toBe(true)
      expect(bucket).toBeGreaterThanOrEqual(0)
      expect(bucket).toBeLessThan(10_000)
    }
  })

  it('spreads values across buckets', () => {
    const buckets = new Set<number>()
    for (let i = 0; i < 200; i++) buckets.add(hashBucket(`contact-${i}`))
    expect(buckets.size).toBeGreaterThan(150)
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com')
  })

  it('returns null for empty or non-email input', () => {
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('not an email')).toBeNull()
  })
})

describe('slugify', () => {
  it('turns names into url-safe slugs', () => {
    expect(slugify('Northstar Roofing')).toBe('northstar-roofing')
    expect(slugify("  Bob's Café & Bar!! ")).toBe('bob-s-caf-bar')
  })

  it('strips leading and trailing dashes', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('caps the length at 48', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(48)
  })

  it('returns an empty string when nothing survives', () => {
    expect(slugify('!!!')).toBe('')
  })
})
