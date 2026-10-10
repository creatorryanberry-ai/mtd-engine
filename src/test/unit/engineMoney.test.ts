import { describe, expect, it } from 'vitest'

import {
  estimateCostMinor,
  grossProfitMinor,
  microsToCents,
  usdToMicros,
} from '~/features/engine/core/money'

describe('grossProfitMinor', () => {
  it('subtracts cost, fees and refunds from revenue', () => {
    expect(
      grossProfitMinor({
        revenueMinor: 10_000,
        costMinor: 4000,
        feesMinor: 300,
        refundedMinor: 700,
      }),
    ).toBe(5000)
  })

  it('treats missing deductions as zero', () => {
    expect(grossProfitMinor({ revenueMinor: 1234 })).toBe(1234)
  })

  it('can go negative on a full refund with fees', () => {
    expect(
      grossProfitMinor({ revenueMinor: 500, feesMinor: 50, refundedMinor: 500 }),
    ).toBe(-50)
  })

  it('rounds to whole minor units', () => {
    expect(grossProfitMinor({ revenueMinor: 100.4, costMinor: 0.2 })).toBe(100)
  })
})

describe('estimateCostMinor', () => {
  it('prefers unit cost times quantity', () => {
    expect(
      estimateCostMinor({ revenueMinor: 9000, unitCostMinor: 250, quantity: 3 }),
    ).toBe(750)
  })

  it('defaults quantity to one', () => {
    expect(estimateCostMinor({ revenueMinor: 9000, unitCostMinor: 250 })).toBe(250)
  })

  it('falls back to the margin rate', () => {
    expect(estimateCostMinor({ revenueMinor: 10_000, grossMarginRate: 0.4 })).toBe(6000)
  })

  it('clamps the margin rate to 0..1', () => {
    expect(estimateCostMinor({ revenueMinor: 10_000, grossMarginRate: 1.5 })).toBe(0)
    expect(estimateCostMinor({ revenueMinor: 10_000, grossMarginRate: -1 })).toBe(10_000)
  })

  it('unit cost wins over margin rate', () => {
    expect(
      estimateCostMinor({
        revenueMinor: 10_000,
        unitCostMinor: 100,
        grossMarginRate: 0.4,
      }),
    ).toBe(100)
  })

  it('returns zero when nothing is known', () => {
    expect(estimateCostMinor({ revenueMinor: 10_000 })).toBe(0)
    expect(
      estimateCostMinor({
        revenueMinor: 10_000,
        unitCostMinor: null,
        grossMarginRate: null,
      }),
    ).toBe(0)
  })
})

describe('llm cost units', () => {
  it('round trips usd through micros to cents', () => {
    expect(usdToMicros(0.0123)).toBe(12_300)
    expect(microsToCents(12_300)).toBe(1)
    expect(microsToCents(usdToMicros(2.5))).toBe(250)
  })
})
