import { afterEach, describe, expect, it } from 'vitest'

import { assertProdAuthFlags } from './assert-prod-auth-flags'

const KEYS = ['ALLOW_DEMO_AUTH', 'VITE_DEMO_MODE'] as const
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {}

function stash() {
  for (const key of KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
}

function restore() {
  for (const key of KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('assertProdAuthFlags', () => {
  afterEach(restore)

  it('passes when demo flags are unset', () => {
    stash()
    expect(() => assertProdAuthFlags()).not.toThrow()
  })

  it('fails when ALLOW_DEMO_AUTH=1', () => {
    stash()
    process.env.ALLOW_DEMO_AUTH = '1'
    expect(() => assertProdAuthFlags()).toThrow(/ALLOW_DEMO_AUTH/)
  })

  it('fails when VITE_DEMO_MODE=1', () => {
    stash()
    process.env.VITE_DEMO_MODE = '1'
    expect(() => assertProdAuthFlags()).toThrow(/VITE_DEMO_MODE/)
  })
})
