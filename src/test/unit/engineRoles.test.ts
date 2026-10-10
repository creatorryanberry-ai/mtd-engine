import { describe, expect, it } from 'vitest'

import { ENGINE_ROLES } from '~/database/engineSchema'
import { ROLE_RANK, isEngineRole, roleAtLeast } from '~/features/engine/core/roles'

describe('roleAtLeast', () => {
  it('orders owner > admin > marketer > approver > viewer', () => {
    expect(ROLE_RANK.owner).toBeLessThan(ROLE_RANK.admin)
    expect(ROLE_RANK.admin).toBeLessThan(ROLE_RANK.marketer)
    expect(ROLE_RANK.marketer).toBeLessThan(ROLE_RANK.approver)
    expect(ROLE_RANK.approver).toBeLessThan(ROLE_RANK.viewer)
  })

  it('a role always satisfies itself', () => {
    for (const role of ENGINE_ROLES) {
      expect(roleAtLeast(role, role)).toBe(true)
    }
  })

  it('owner satisfies every minimum and viewer only viewer', () => {
    for (const minimum of ENGINE_ROLES) {
      expect(roleAtLeast('owner', minimum)).toBe(true)
      expect(roleAtLeast('viewer', minimum)).toBe(minimum === 'viewer')
    }
  })

  it('lower roles never satisfy a higher minimum', () => {
    expect(roleAtLeast('admin', 'owner')).toBe(false)
    expect(roleAtLeast('marketer', 'admin')).toBe(false)
    expect(roleAtLeast('approver', 'marketer')).toBe(false)
    expect(roleAtLeast('marketer', 'viewer')).toBe(true)
    expect(roleAtLeast('approver', 'viewer')).toBe(true)
  })
})

describe('isEngineRole', () => {
  it('accepts known roles and rejects anything else', () => {
    expect(isEngineRole('owner')).toBe(true)
    expect(isEngineRole('viewer')).toBe(true)
    expect(isEngineRole('superuser')).toBe(false)
    expect(isEngineRole(1)).toBe(false)
    expect(isEngineRole(null)).toBe(false)
  })
})
