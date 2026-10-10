import * as v from 'valibot'
import { describe, expect, it } from 'vitest'

import { incrementalReportSchema } from '~/features/engine/contract'
import {
  buildIncrementalReport,
  holdoutBucketThreshold,
} from '~/features/engine/measure/incrementalReport'
import {
  isInGlobalHoldout,
  momentsOf,
  welchDifference,
} from '~/features/engine/measure/stats'

import type { IncrementalInput } from '~/features/engine/measure/incrementalReport'

function base(overrides: Partial<IncrementalInput> = {}): IncrementalInput {
  return {
    windowFrom: '2026-10-05T00:00:00.000Z',
    windowTo: '2026-10-10T12:00:00.000Z',
    currency: 'GBP',
    holdoutRate: 0.05,
    treated: momentsOf([]),
    holdout: momentsOf([]),
    unattributedOrders: 0,
    ...overrides,
  }
}

/** deterministic heavy-tailed sample: most contacts 0, a few buyers */
function sample(n: number, every: number, value: number) {
  return Array.from({ length: n }, (_, i) =>
    i % every === 0 ? value + (i % 7) * 100 : 0,
  )
}

describe('holdoutBucketThreshold', () => {
  it('matches isInGlobalHoldout at the boundary', () => {
    for (const rate of [0, 0.01, 0.05, 0.1, 0.123456, 0.5, 0.9, -1]) {
      const threshold = holdoutBucketThreshold(rate)
      if (threshold > 0) expect(isInGlobalHoldout(threshold - 1, rate)).toBe(true)
      expect(isInGlobalHoldout(threshold, rate)).toBe(false)
    }
    expect(holdoutBucketThreshold(0.05)).toBe(500)
    expect(holdoutBucketThreshold(0)).toBe(0)
    expect(holdoutBucketThreshold(0.9)).toBe(5000)
  })
})

describe('buildIncrementalReport', () => {
  it('scales the welch difference and interval by treated contacts', () => {
    const treated = momentsOf(sample(2000, 10, 5_000))
    const holdout = momentsOf(sample(200, 12, 5_000))
    const report = buildIncrementalReport(base({ treated, holdout }))
    const welch = welchDifference(treated, holdout)

    expect(report.method).toBe('global_holdout')
    expect(report.treatedContacts).toBe(2000)
    expect(report.holdoutContacts).toBe(200)
    expect(report.incrementalMinor).toBe(Math.round(welch.estimate * 2000))
    expect(report.ciLowMinor).toBe(Math.round(welch.low * 2000))
    expect(report.ciHighMinor).toBe(Math.round(welch.high * 2000))
    expect(report.pValue).toBeCloseTo(welch.pValue!, 12)
    expect(report.treatedMeanMinor).toBeCloseTo(treated.sum / 2000, 9)
    expect(v.safeParse(incrementalReportSchema, report).success).toBe(true)
  })

  it('calls a positive lift once both groups reach 100', () => {
    const treated = momentsOf(sample(1000, 2, 10_000))
    const holdout = momentsOf(sample(100, 10, 1_000))
    const report = buildIncrementalReport(base({ treated, holdout }))
    expect(report.verdict).toBe('positive')
    expect(report.ciLowMinor!).toBeGreaterThan(0)
  })

  it('calls a negative lift', () => {
    const treated = momentsOf(sample(1000, 10, 1_000))
    const holdout = momentsOf(sample(150, 2, 10_000))
    const report = buildIncrementalReport(base({ treated, holdout }))
    expect(report.verdict).toBe('negative')
    expect(report.ciHighMinor!).toBeLessThan(0)
  })

  it('stays collecting below the minimum sample whatever the interval says', () => {
    const treated = momentsOf(sample(1000, 2, 10_000))
    const holdout = momentsOf(sample(99, 10, 1_000))
    const report = buildIncrementalReport(base({ treated, holdout }))
    expect(report.verdict).toBe('collecting')
    expect(report.note).toContain('at least 100')
  })

  it('turns undefined statistics into null instead of NaN or Infinity', () => {
    const report = buildIncrementalReport(
      base({ treated: momentsOf([500]), holdout: momentsOf([]) }),
    )
    expect(report.incrementalMinor).toBe(500)
    expect(report.ciLowMinor).toBeNull()
    expect(report.ciHighMinor).toBeNull()
    expect(report.pValue).toBeNull()
    expect(report.verdict).toBe('collecting')
    expect(v.safeParse(incrementalReportSchema, report).success).toBe(true)

    const empty = buildIncrementalReport(base())
    expect(empty.treatedMeanMinor).toBe(0)
    expect(empty.incrementalMinor).toBe(0)
    expect(v.safeParse(incrementalReportSchema, empty).success).toBe(true)
  })

  it('reports zero variance groups with a degenerate interval', () => {
    const report = buildIncrementalReport(
      base({
        treated: momentsOf(Array(150).fill(0)),
        holdout: momentsOf(Array(150).fill(0)),
      }),
    )
    expect(report.incrementalMinor).toBe(0)
    expect(report.ciLowMinor).toBe(0)
    expect(report.ciHighMinor).toBe(0)
    expect(report.verdict).toBe('inconclusive')
  })

  it('explains the untreated baseline and unattributed orders in the note', () => {
    const report = buildIncrementalReport(base({ unattributedOrders: 3 }))
    expect(report.note).toContain('should straddle zero')
    expect(report.note).toContain('3 paid orders')
    expect(buildIncrementalReport(base({ unattributedOrders: 1 })).note).toContain(
      '1 paid order in',
    )
    expect(buildIncrementalReport(base({ holdoutRate: 0 })).note).toContain(
      'holdout rate is 0',
    )
  })
})
