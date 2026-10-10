import { describe, expect, it } from 'vitest'

import {
  addChannelCredit,
  addDays,
  applyEventAggregate,
  dayDiff,
  emptyDayMetrics,
  finiteOrNull,
  hasActivity,
  isDay,
  listDays,
  resolveDayRange,
  roundCredit,
  roundHalfEven,
  utcDay,
} from '~/features/engine/measure/metricsMath'

import type { ChannelCredit } from '~/features/engine/measure/metricsMath'

describe('day helpers', () => {
  it('works in utc across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(dayDiff('2026-10-01', '2026-10-10')).toBe(9)
    expect(dayDiff('2026-10-10', '2026-10-01')).toBe(-9)
    expect(utcDay(new Date('2026-10-10T23:59:59.999Z'))).toBe('2026-10-10')
    expect(listDays('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
    expect(listDays('2026-10-02', '2026-10-01')).toEqual([])
  })

  it('validates day strings', () => {
    expect(isDay('2026-10-10')).toBe(true)
    expect(isDay('2026-13-10')).toBe(false)
    expect(isDay('2026-10-10T00:00:00Z')).toBe(false)
  })

  it('resolves ranges with defaults and caps to the most recent days', () => {
    expect(
      resolveDayRange({ today: '2026-10-10', defaultDays: 7, maxDays: 120 }),
    ).toEqual({ fromDay: '2026-10-04', toDay: '2026-10-10', days: 7 })
    expect(
      resolveDayRange({
        from: '2026-01-01',
        to: '2026-10-10',
        today: '2026-10-10',
        defaultDays: 7,
        maxDays: 120,
      }),
    ).toEqual({ fromDay: '2026-06-13', toDay: '2026-10-10', days: 120 })
    expect(
      resolveDayRange({
        from: '2026-10-11',
        to: '2026-10-10',
        today: '2026-10-10',
        defaultDays: 7,
        maxDays: 120,
      }),
    ).toBeNull()
  })
})

describe('roundHalfEven', () => {
  it('rounds ties to the even neighbour', () => {
    expect(roundHalfEven(0.5)).toBe(0)
    expect(roundHalfEven(1.5)).toBe(2)
    expect(roundHalfEven(2.5)).toBe(2)
    expect(roundHalfEven(-0.5)).toBe(0)
    expect(roundHalfEven(-1.5)).toBe(-2)
    expect(roundHalfEven(-2.5)).toBe(-2)
  })

  it('treats float noise around a tie as a tie', () => {
    expect(roundHalfEven(0.1 + 0.2 + 0.2)).toBe(0)
    expect(roundHalfEven(2.4999999999)).toBe(2)
  })

  it('rounds non-ties normally and guards non-finite values', () => {
    expect(roundHalfEven(2.51)).toBe(3)
    expect(roundHalfEven(-2.51)).toBe(-3)
    expect(roundHalfEven(Number.NaN)).toBe(0)
  })
})

describe('finiteOrNull', () => {
  it('nulls NaN and infinities', () => {
    expect(finiteOrNull(1.5)).toBe(1.5)
    expect(finiteOrNull(Number.NaN)).toBeNull()
    expect(finiteOrNull(Number.POSITIVE_INFINITY)).toBeNull()
    expect(finiteOrNull(null)).toBeNull()
  })
})

describe('event aggregates', () => {
  it('maps event types onto metrics and keeps platform null until reported', () => {
    const metrics = emptyDayMetrics()
    expect(hasActivity(metrics)).toBe(false)
    const row = {
      day: '2026-10-10',
      channelKey: 'meta_ads',
      valueMinor: 0,
      platformConversions: 0,
    }
    applyEventAggregate(metrics, { ...row, type: 'impression', count: 100 })
    applyEventAggregate(metrics, { ...row, type: 'click', count: 7 })
    applyEventAggregate(metrics, { ...row, type: 'visit', count: 50 })
    applyEventAggregate(metrics, { ...row, type: 'spend', count: 2, valueMinor: 12_345 })
    applyEventAggregate(metrics, { ...row, type: 'unsubscribe', count: 1 })
    applyEventAggregate(metrics, { ...row, type: 'complaint', count: 2 })
    expect(metrics).toEqual({
      spendMinor: 12_345,
      impressions: 100,
      clicks: 7,
      unsubscribes: 1,
      complaints: 2,
      platformConversions: null,
      platformRevenueMinor: null,
    })
    applyEventAggregate(metrics, {
      ...row,
      type: 'platform_report',
      count: 1,
      valueMinor: 9_000,
      platformConversions: 3,
    })
    expect(metrics.platformConversions).toBe(3)
    expect(metrics.platformRevenueMinor).toBe(9_000)

    const reportedZero = emptyDayMetrics()
    applyEventAggregate(reportedZero, { ...row, type: 'platform_report', count: 1 })
    expect(reportedZero.platformConversions).toBe(0)
    expect(hasActivity(reportedZero)).toBe(true)
  })

  it('accumulates fractional credit and rounds once at the end', () => {
    const credit = new Map<string, ChannelCredit>()
    const outcome = { revenueMinor: 1_001, grossProfitMinor: 501, isNewCustomer: true }
    addChannelCredit(credit, '2026-10-10|email', 0.5, outcome)
    addChannelCredit(credit, '2026-10-10|email', 0.25, {
      ...outcome,
      isNewCustomer: false,
    })
    addChannelCredit(credit, '2026-10-10|email', 0.75, outcome)
    const raw = credit.get('2026-10-10|email')!
    expect(raw.conversions).toBeCloseTo(1.5, 12)
    expect(raw.newCustomers).toBeCloseTo(1.25, 12)
    expect(roundCredit(raw)).toEqual({
      conversions: 2,
      newCustomers: 1,
      revenueMinor: 1_502,
      grossProfitMinor: 752,
    })
  })
})
