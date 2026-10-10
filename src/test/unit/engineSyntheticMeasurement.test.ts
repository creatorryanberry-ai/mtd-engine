import { describe, expect, it } from 'vitest'

import {
  generateNurtureAudience,
  generateNurtureOutcomes,
  generatePaidMedia,
} from '~/features/engine/seed/syntheticMeasurement'

const now = new Date('2026-10-10T09:00:00Z')

describe('generateNurtureAudience', () => {
  it('is deterministic with unique emails', () => {
    const a = generateNurtureAudience({ count: 500 })
    expect(a).toEqual(generateNurtureAudience({ count: 500 }))
    expect(new Set(a.map((l) => l.email)).size).toBe(500)
    expect(a.every((l) => l.firstSeenAt < now.toISOString())).toBe(true)
  })
})

describe('generateNurtureOutcomes', () => {
  const startedAt = new Date(now.getTime() - 42 * 86_400_000)
  const contacts = Array.from({ length: 20_000 }, (_, i) => ({
    contactId: `ct_${i}`,
    email: `c${i}@example.com`,
    isHoldout: i % 5 === 0,
  }))

  it('treated contacts convert more and only treated contacts get emails', () => {
    const { orders, touches } = generateNurtureOutcomes({ contacts, startedAt, now })
    const holdoutIds = new Set(
      contacts.filter((c) => c.isHoldout).map((c) => c.contactId),
    )
    const holdoutOrders = orders.filter((o) => holdoutIds.has(o.contactId)).length
    const treatedOrders = orders.length - holdoutOrders
    const holdoutRate = holdoutOrders / holdoutIds.size
    const treatedRate = treatedOrders / (contacts.length - holdoutIds.size)
    expect(holdoutRate).toBeGreaterThan(0.012)
    expect(holdoutRate).toBeLessThan(0.028)
    expect(treatedRate).toBeGreaterThan(0.034)
    expect(treatedRate).toBeLessThan(0.046)
    expect(touches.some((t) => holdoutIds.has(t.contactId ?? ''))).toBe(false)
  })

  it('keeps every order and touch inside the window', () => {
    const { orders, touches } = generateNurtureOutcomes({
      contacts: contacts.slice(0, 2000),
      startedAt,
      now,
    })
    for (const item of [...orders, ...touches]) {
      expect(item.occurredAt >= startedAt.toISOString()).toBe(true)
      expect(item.occurredAt < now.toISOString()).toBe(true)
    }
    expect(new Set(orders.map((o) => o.externalId)).size).toBe(orders.length)
  })
})

describe('generatePaidMedia', () => {
  it('emits one spend and one platform report per channel per day', () => {
    const events = generatePaidMedia({ days: 10 })
    expect(events.filter((e) => e.type === 'spend')).toHaveLength(20)
    expect(events.filter((e) => e.type === 'platform_report')).toHaveLength(20)
    expect(new Set(events.map((e) => e.sourceEventId)).size).toBe(events.length)
    for (const e of events) {
      if (e.type === 'platform_report')
        expect(typeof e.properties.conversions).toBe('number')
      else expect(e.valueMinor).toBeGreaterThan(0)
    }
  })
})
