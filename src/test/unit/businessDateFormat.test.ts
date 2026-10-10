import { describe, expect, it } from 'vitest'

import {
  dateToIso,
  formatBusinessDateUk,
  isValidIsoDate,
  isoToDate,
  parseBusinessDateUk,
} from '~/features/business/businessDateFormat'

describe('businessDateFormat', () => {
  it('formats ISO dates as UK display', () => {
    expect(formatBusinessDateUk('2020-04-06')).toBe('06/04/2020')
  })

  it('parses UK dates to ISO', () => {
    expect(parseBusinessDateUk('06/04/2020')).toBe('2020-04-06')
  })

  it('rejects invalid UK dates', () => {
    expect(parseBusinessDateUk('31/02/2020')).toBeNull()
    expect(parseBusinessDateUk('6/4/2020')).toBeNull()
  })

  it('validates ISO dates', () => {
    expect(isValidIsoDate('2020-04-06')).toBe(true)
    expect(isValidIsoDate('2020-02-31')).toBe(false)
  })

  it('round-trips through date helpers', () => {
    const date = isoToDate('2020-04-06')
    expect(dateToIso(date)).toBe('2020-04-06')
  })
})
