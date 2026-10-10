import { describe, expect, it, vi } from 'vitest'

import {
  drawFor,
  exclusionReason,
  globalHoldoutThreshold,
  sortArms,
} from '~/features/engine/measure/server/assignment'
import { isInGlobalHoldout, pickArm } from '~/features/engine/measure/stats'

vi.mock('~/database/db', () => ({ drizzle: {} }))

describe('drawFor', () => {
  it('is deterministic per salt and contact', () => {
    expect(drawFor('salt', 'ct_1')).toBe(drawFor('salt', 'ct_1'))
    expect(drawFor('salt', 'ct_1')).not.toBe(drawFor('salt', 'ct_2'))
    expect(drawFor('other', 'ct_1')).not.toBe(drawFor('salt', 'ct_1'))
  })

  it('matches the first four bytes of sha-256 over 2^32', () => {
    // sha256("s:c") = 97a9a904...
    expect(drawFor('s', 'c')).toBeCloseTo(0x97a9a904 / 2 ** 32, 12)
  })

  it('is uniform on [0, 1)', () => {
    const draws = 20_000
    const buckets = Array.from({ length: 10 }, () => 0)
    let sum = 0
    let min = 1
    let max = 0
    for (let i = 0; i < draws; i++) {
      const u = drawFor('uniformity', `ct_${i}`)
      buckets[Math.floor(u * 10)]! += 1
      sum += u
      min = Math.min(min, u)
      max = Math.max(max, u)
    }
    expect(min).toBeGreaterThanOrEqual(0)
    expect(max).toBeLessThan(1)
    expect(sum / draws).toBeCloseTo(0.5, 1)
    // chi-square with 9 df; 27.9 is the 0.999 quantile
    const expected = draws / 10
    const chiSquare = buckets.reduce((acc, n) => acc + (n - expected) ** 2 / expected, 0)
    expect(chiSquare).toBeLessThan(27.9)
  })

  it('splits a population close to the intended shares through pickArm', () => {
    const arms = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 3 },
    ]
    const counts = { holdout: 0, a: 0, b: 0 }
    for (let i = 0; i < 20_000; i++) {
      const pick = pickArm(drawFor('split', `ct_${i}`), 0.2, arms)
      if (pick.isHoldout) counts.holdout += 1
      else counts[pick.armId as 'a' | 'b'] += 1
    }
    expect(counts.holdout / 20_000).toBeCloseTo(0.2, 1)
    expect(counts.a / 20_000).toBeCloseTo(0.2, 1)
    expect(counts.b / 20_000).toBeCloseTo(0.6, 1)
  })
})

describe('eligibility', () => {
  const base = {
    id: 'ct_1',
    hashBucket: 5000,
    lifecycleStage: 'lead',
    consentStatus: null,
  }

  it('excludes the permanent global holdout first', () => {
    expect(
      exclusionReason(
        { ...base, hashBucket: 10 },
        { globalHoldoutRate: 0.05, audience: {} },
      ),
    ).toBe('global_holdout')
    expect(exclusionReason(base, { globalHoldoutRate: 0.05, audience: {} })).toBeNull()
  })

  it('applies the lifecycle audience and consent rules', () => {
    const audience = { lifecycleStages: ['customer'], requireConsentChannel: 'email' }
    const rules = { globalHoldoutRate: 0.05, audience }
    expect(exclusionReason(base, rules)).toBe('audience')
    expect(exclusionReason({ ...base, lifecycleStage: 'customer' }, rules)).toBe(
      'consent',
    )
    for (const status of ['granted', 'soft_optin', 'corporate_subscriber']) {
      expect(
        exclusionReason(
          { ...base, lifecycleStage: 'customer', consentStatus: status },
          rules,
        ),
      ).toBeNull()
    }
    for (const status of ['withdrawn', 'unknown']) {
      expect(
        exclusionReason(
          { ...base, lifecycleStage: 'customer', consentStatus: status },
          rules,
        ),
      ).toBe('consent')
    }
    expect(
      exclusionReason(base, { globalHoldoutRate: 0, audience: { lifecycleStages: [] } }),
    ).toBeNull()
  })

  it('derives an sql threshold that agrees with isInGlobalHoldout on every bucket', () => {
    for (const rate of [0, 0.01, 0.05, 0.123, 0.5, 0.9]) {
      const threshold = globalHoldoutThreshold(rate)
      for (let bucket = 0; bucket < 10_000; bucket += 7) {
        expect(bucket < threshold).toBe(isInGlobalHoldout(bucket, rate))
      }
    }
    expect(globalHoldoutThreshold(0.05)).toBe(500)
  })

  it('orders arms by their defined position', () => {
    const arms = [
      { id: 'arm_z', weight: 1, config: { position: 0 } },
      { id: 'arm_a', weight: 1, config: { position: 1 } },
      { id: 'arm_m', weight: 1, config: {} },
    ]
    expect(sortArms(arms).map((arm) => arm.id)).toEqual(['arm_z', 'arm_a', 'arm_m'])
  })
})
