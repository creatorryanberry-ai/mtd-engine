import { describe, expect, it } from 'vitest'

import {
  ATTRIBUTION_MODELS,
  creditTouches,
  parseTimestamp,
} from '~/features/engine/measure/attribution'

const OUTCOME = '2026-10-10T12:00:00.000Z'

function daysBefore(days: number) {
  return new Date(Date.parse(OUTCOME) - days * 24 * 60 * 60 * 1000).toISOString()
}

const journey = [
  { channelKey: 'meta_ads', occurredAt: daysBefore(10) },
  { channelKey: 'email', occurredAt: daysBefore(5) },
  { channelKey: 'web', occurredAt: daysBefore(3) },
  { channelKey: 'google_ads', occurredAt: daysBefore(1) },
]

function sum(shares: Record<string, number>) {
  return Object.values(shares).reduce((a, b) => a + b, 0)
}

describe('creditTouches', () => {
  it('returns an empty object without touches', () => {
    for (const model of ATTRIBUTION_MODELS) {
      expect(creditTouches([], OUTCOME, model)).toEqual({})
    }
  })

  it('gives a single touch 100% under every model', () => {
    const touches = [{ channelKey: 'email', occurredAt: daysBefore(2) }]
    for (const model of ATTRIBUTION_MODELS) {
      expect(creditTouches(touches, OUTCOME, model)).toEqual({ email: 1 })
    }
  })

  it('shares always sum to 1', () => {
    for (const model of ATTRIBUTION_MODELS) {
      expect(sum(creditTouches(journey, OUTCOME, model))).toBeCloseTo(1, 12)
    }
  })

  it('last and first touch use time order, not input order', () => {
    const shuffled = [journey[2]!, journey[0]!, journey[3]!, journey[1]!]
    expect(creditTouches(shuffled, OUTCOME, 'last_touch')).toEqual({ google_ads: 1 })
    expect(creditTouches(shuffled, OUTCOME, 'first_touch')).toEqual({ meta_ads: 1 })
  })

  it('linear splits evenly', () => {
    const shares = creditTouches(journey, OUTCOME, 'linear')
    for (const key of ['meta_ads', 'email', 'web', 'google_ads']) {
      expect(shares[key]).toBeCloseTo(0.25, 12)
    }
  })

  it('time decay halves weight every half-life', () => {
    const touches = [
      { channelKey: 'a', occurredAt: daysBefore(7) },
      { channelKey: 'b', occurredAt: daysBefore(0) },
    ]
    const shares = creditTouches(touches, OUTCOME, 'time_decay')
    expect(shares.a).toBeCloseTo(1 / 3, 12)
    expect(shares.b).toBeCloseTo(2 / 3, 12)

    const custom = creditTouches(touches, OUTCOME, 'time_decay', { halfLifeDays: 3.5 })
    expect(custom.a).toBeCloseTo(1 / 5, 12)
    expect(custom.b).toBeCloseTo(4 / 5, 12)
  })

  it('time decay does not underflow over long lookbacks', () => {
    const touches = [
      { channelKey: 'a', occurredAt: daysBefore(900) },
      { channelKey: 'b', occurredAt: daysBefore(899) },
    ]
    const shares = creditTouches(touches, OUTCOME, 'time_decay', { halfLifeDays: 0.01 })
    expect(sum(shares)).toBeCloseTo(1, 12)
    expect(shares.b).toBeCloseTo(1, 12)
  })

  it('position based gives 40/20/40 with the middle spread', () => {
    const shares = creditTouches(journey, OUTCOME, 'position_based')
    expect(shares.meta_ads).toBeCloseTo(0.4, 12)
    expect(shares.google_ads).toBeCloseTo(0.4, 12)
    expect(shares.email).toBeCloseTo(0.1, 12)
    expect(shares.web).toBeCloseTo(0.1, 12)
  })

  it('position based splits two touches 50/50', () => {
    const shares = creditTouches(journey.slice(0, 2), OUTCOME, 'position_based')
    expect(shares).toEqual({ meta_ads: 0.5, email: 0.5 })
  })

  it('position based with three touches gives the middle 20%', () => {
    const shares = creditTouches(journey.slice(0, 3), OUTCOME, 'position_based')
    expect(shares.meta_ads).toBeCloseTo(0.4, 12)
    expect(shares.email).toBeCloseTo(0.2, 12)
    expect(shares.web).toBeCloseTo(0.4, 12)
  })

  it('merges shares when a channel touches more than once', () => {
    const touches = [
      { channelKey: 'email', occurredAt: daysBefore(4) },
      { channelKey: 'web', occurredAt: daysBefore(3) },
      { channelKey: 'email', occurredAt: daysBefore(1) },
    ]
    expect(creditTouches(touches, OUTCOME, 'linear').email).toBeCloseTo(2 / 3, 12)
    expect(creditTouches(touches, OUTCOME, 'position_based').email).toBeCloseTo(0.8, 12)
    expect(creditTouches(touches, OUTCOME, 'last_touch')).toEqual({ email: 1 })
  })

  it('ignores touches after the outcome and unparseable times', () => {
    const touches = [
      { channelKey: 'email', occurredAt: daysBefore(2) },
      { channelKey: 'meta_ads', occurredAt: daysBefore(-1) },
      { channelKey: 'web', occurredAt: 'not a date' },
    ]
    expect(creditTouches(touches, OUTCOME, 'linear')).toEqual({ email: 1 })
    expect(creditTouches(touches, 'nonsense', 'linear')).toEqual({})
  })

  it('keeps input order for touches at the same instant', () => {
    const at = daysBefore(1)
    const touches = [
      { channelKey: 'email', occurredAt: at },
      { channelKey: 'web', occurredAt: at },
    ]
    expect(creditTouches(touches, OUTCOME, 'first_touch')).toEqual({ email: 1 })
    expect(creditTouches(touches, OUTCOME, 'last_touch')).toEqual({ web: 1 })
  })

  it('accepts postgres text timestamps', () => {
    const touches = [{ channelKey: 'email', occurredAt: '2026-10-09 08:00:00.5+00' }]
    expect(creditTouches(touches, '2026-10-10 12:00:00+00', 'time_decay')).toEqual({
      email: 1,
    })
  })
})

describe('parseTimestamp', () => {
  it('parses iso and postgres formats to the same instant', () => {
    const iso = Date.parse('2026-10-10T12:00:00.123Z')
    expect(parseTimestamp('2026-10-10T12:00:00.123Z')).toBe(iso)
    expect(parseTimestamp('2026-10-10 12:00:00.123+00')).toBe(iso)
    expect(parseTimestamp('2026-10-10 13:00:00.123+01')).toBe(iso)
  })
})
