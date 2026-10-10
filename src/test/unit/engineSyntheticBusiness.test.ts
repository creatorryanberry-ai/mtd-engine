import { describe, expect, it } from 'vitest'

import {
  createRng,
  generateSyntheticBusiness,
  SYNTHETIC_BRAND_KIT,
} from '~/features/engine/seed/syntheticBusiness'

describe('generateSyntheticBusiness', () => {
  it('is deterministic for a given seed', () => {
    const a = generateSyntheticBusiness({ seed: 7 })
    const b = generateSyntheticBusiness({ seed: 7 })
    expect(a).toEqual(b)
    const c = generateSyntheticBusiness({ seed: 8 })
    expect(c.contacts[0]!.email).not.toEqual(a.contacts[0]!.email)
  })

  it('produces a coherent business', () => {
    const biz = generateSyntheticBusiness()
    expect(biz.companies).toHaveLength(40)
    expect(biz.contacts).toHaveLength(120)
    expect(biz.events).toHaveLength(2000)
    expect(biz.orders.length).toBeGreaterThan(10)

    const emails = new Set(biz.contacts.map((c) => c.email))
    expect(emails.size).toBe(biz.contacts.length)

    const contactKeys = new Set(biz.contacts.map((c) => c.key))
    for (const order of biz.orders) {
      expect(contactKeys.has(order.contactKey)).toBe(true)
      expect(order.revenueMinor).toBeGreaterThan(0)
      expect(order.costMinor).toBeLessThan(order.revenueMinor)
      expect(order.refundedMinor).toBeLessThanOrEqual(order.revenueMinor)
    }

    const customerKeys = new Set(
      biz.contacts.filter((c) => c.lifecycleStage === 'customer').map((c) => c.key),
    )
    for (const order of biz.orders) expect(customerKeys.has(order.contactKey)).toBe(true)

    for (const deal of biz.deals) {
      expect(deal.status === 'open').toBe(deal.closedAt === null)
    }
  })

  it('brand kit claims mark unproven claims as not approved', () => {
    const unapproved = SYNTHETIC_BRAND_KIT.claims.filter((c) => !c.approved)
    expect(unapproved.map((c) => c.claim)).toContain('Lowest price in the region')
  })

  it('rng stays in [0, 1)', () => {
    const rng = createRng(1)
    for (let i = 0; i < 1000; i++) {
      const n = rng()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })
})
