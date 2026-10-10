import * as v from 'valibot'
import { describe, expect, it, vi } from 'vitest'

import { experimentResultSchema } from '~/features/engine/contract'
import { buildExperimentResult } from '~/features/engine/measure/server/results'

import type {
  BuildExperimentResultInput,
  GroupAggregate,
} from '~/features/engine/measure/server/results'

vi.mock('~/database/db', () => ({ drizzle: {} }))

/** n contacts, `buyers` of whom bought once for `profit` minor units */
function group(key: string, n: number, buyers: number, profit = 10_000): GroupAggregate {
  return {
    key,
    n,
    conversions: buyers,
    sum: buyers * profit,
    sumSq: buyers * profit * profit,
  }
}

const TREATMENT = { id: 'arm_t', name: 'Treatment', isControl: false, weight: 1 }

function holdoutInput(
  aggregates: GroupAggregate[],
  overrides: Partial<BuildExperimentResultInput> = {},
): BuildExperimentResultInput {
  return {
    successMetric: 'incremental_gross_profit',
    holdoutRate: 0.5,
    minSamplePerArm: 200,
    currency: 'GBP',
    arms: [TREATMENT],
    aggregates,
    windowFrom: '2026-10-01T00:00:00.000Z',
    windowTo: '2026-10-10T00:00:00.000Z',
    computedAt: '2026-10-10T00:00:00.000Z',
    ...overrides,
  }
}

function allNumbersFinite(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(allNumbersFinite)
  if (value && typeof value === 'object')
    return Object.values(value).every(allNumbersFinite)
  return true
}

function expectValid(result: ReturnType<typeof buildExperimentResult>) {
  expect(() => v.parse(experimentResultSchema, result)).not.toThrow()
  expect(allNumbersFinite(result)).toBe(true)
}

describe('buildExperimentResult', () => {
  it('calls a positive lift when treatment clearly beats the holdout', () => {
    const result = buildExperimentResult(
      holdoutInput([group('arm_t', 300, 60), group('holdout', 300, 20)]),
    )
    expectValid(result)
    expect(result.groups.map((g) => g.key)).toEqual(['holdout', 'arm_t'])
    expect(result.comparisons).toHaveLength(2)

    const primary = result.primary!
    expect(primary.metric).toBe('gross_profit_per_contact')
    expect(primary.treatmentKey).toBe('arm_t')
    expect(primary.baselineKey).toBe('holdout')
    expect(primary.verdict).toBe('positive')
    expect(primary.diff).toBeCloseTo(2000 - 666.6667, 3)
    expect(primary.ciLow!).toBeGreaterThan(0)
    expect(primary.relativeLift).toBeCloseTo(2, 5)
    expect(primary.incrementalGrossProfitMinor).toBe(Math.round(primary.diff * 300))
    expect(primary.incrementalCiLowMinor).toBe(Math.round(primary.ciLow! * 300))
    expect(primary.probabilityBetter).toBeNull()

    const conversion = result.comparisons.find((c) => c.metric === 'conversion_rate')!
    expect(conversion.verdict).toBe('positive')
    expect(conversion.probabilityBetter!).toBeGreaterThan(0.99)
    expect(conversion.incrementalGrossProfitMinor).toBeNull()
    expect(result.srm.mismatch).toBe(false)
    expect(result.warnings).toEqual([])
  })

  it('calls a negative lift and uses conversion rate when it is the success metric', () => {
    const result = buildExperimentResult(
      holdoutInput([group('arm_t', 300, 20), group('holdout', 300, 60)], {
        successMetric: 'conversion_rate',
      }),
    )
    expectValid(result)
    expect(result.primaryMetric).toBe('conversion_rate')
    expect(result.primary!.metric).toBe('conversion_rate')
    expect(result.primary!.verdict).toBe('negative')
    expect(result.primary!.probabilityBetter!).toBeLessThan(0.01)
    const gp = result.comparisons.find((c) => c.metric === 'gross_profit_per_contact')!
    expect(gp.verdict).toBe('negative')
    expect(gp.ciHigh!).toBeLessThan(0)
  })

  it('keeps collecting below the minimum sample whatever the interval says', () => {
    const result = buildExperimentResult(
      holdoutInput([group('arm_t', 120, 60), group('holdout', 120, 2)]),
    )
    expectValid(result)
    expect(result.primary!.ciLow!).toBeGreaterThan(0)
    expect(result.comparisons.every((c) => c.verdict === 'collecting')).toBe(true)
    expect(result.warnings.some((w) => w.includes('minimum sample of 200'))).toBe(true)
  })

  it('flags a sample ratio mismatch against the intended split', () => {
    // intended 10% holdout, observed 50/50
    const result = buildExperimentResult(
      holdoutInput([group('arm_t', 500, 50), group('holdout', 500, 50)], {
        holdoutRate: 0.1,
      }),
    )
    expectValid(result)
    expect(result.srm.mismatch).toBe(true)
    expect(result.srm.pValue).toBeLessThan(0.001)
    expect(result.warnings.some((w) => w.startsWith('Sample ratio mismatch'))).toBe(true)

    const balanced = buildExperimentResult(
      holdoutInput([group('arm_t', 900, 90), group('holdout', 100, 10)], {
        holdoutRate: 0.1,
      }),
    )
    expect(balanced.srm.mismatch).toBe(false)
    expect(balanced.srm.chiSquare).toBeCloseTo(0, 10)
  })

  it('returns nulls instead of NaN or Infinity for groups below two contacts', () => {
    const result = buildExperimentResult(
      holdoutInput([group('arm_t', 1, 1)], {
        exclusions: { global_holdout: 3, audience: 2, consent: 1 },
      }),
    )
    expectValid(result)
    const holdout = result.groups.find((g) => g.isHoldout)!
    expect(holdout.n).toBe(0)
    expect(holdout.conversionRate).toBe(0)
    expect(holdout.meanGrossProfitMinor).toBe(0)

    const gp = result.comparisons.find((c) => c.metric === 'gross_profit_per_contact')!
    expect(gp.ciLow).toBeNull()
    expect(gp.ciHigh).toBeNull()
    expect(gp.pValue).toBeNull()
    expect(gp.relativeLift).toBeNull()
    expect(gp.incrementalCiLowMinor).toBeNull()
    expect(gp.incrementalCiHighMinor).toBeNull()
    expect(gp.verdict).toBe('collecting')

    const conversion = result.comparisons.find((c) => c.metric === 'conversion_rate')!
    expect(conversion.ciLow).toBeNull()
    expect(conversion.pValue).toBeNull()
    expect(conversion.probabilityBetter).toBeNull()
    expect(result.warnings.some((w) => w.startsWith('6 contacts excluded'))).toBe(true)
  })

  it('compares arms with the control and the control with the holdout in an a/b test', () => {
    const arms = [
      { id: 'arm_a', name: 'Control', isControl: true, weight: 1 },
      { id: 'arm_b', name: 'Variant', isControl: false, weight: 1 },
    ]
    const result = buildExperimentResult(
      holdoutInput(
        [group('holdout', 100, 5), group('arm_a', 450, 40), group('arm_b', 450, 70)],
        { arms, holdoutRate: 0.1 },
      ),
    )
    expectValid(result)
    const pairs = result.comparisons.map(
      (c) => `${c.treatmentKey}>${c.baselineKey}:${c.metric}`,
    )
    expect(pairs).toEqual([
      'arm_b>arm_a:gross_profit_per_contact',
      'arm_b>arm_a:conversion_rate',
      'arm_a>holdout:gross_profit_per_contact',
      'arm_a>holdout:conversion_rate',
    ])
    expect(result.primary!.treatmentKey).toBe('arm_b')
    expect(result.primary!.baselineKey).toBe('arm_a')
    expect(result.srm.mismatch).toBe(false)
  })

  it('warns when there is no baseline', () => {
    const result = buildExperimentResult(
      holdoutInput([group('arm_t', 300, 30)], { holdoutRate: 0 }),
    )
    expectValid(result)
    expect(result.comparisons).toEqual([])
    expect(result.primary).toBeNull()
    expect(result.warnings).toContain(
      'No baseline group: add a control arm or a holdout to measure lift.',
    )
  })
})
