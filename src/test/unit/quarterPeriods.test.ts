import { describe, expect, it } from 'vitest'

import {
  getCurrentQuarter,
  getFinalDeclarationDeadline,
  getQuarterForDate,
  getQuarterInfo,
  getQuartersForTaxYear,
  getTaxYearForDate,
  isDateInHmrcUpdatePeriod,
  isDateInQuarter,
  isDateInTaxYear,
  listAvailableTaxYears,
  parseQuarterId,
  parseTaxYearStart,
  usesCumulativeHmrcSubmission,
} from '~/features/mtd/utils/quarterPeriods'

describe('getTaxYearForDate', () => {
  it('maps mid-year dates to the current tax year', () => {
    expect(getTaxYearForDate('2026-07-18').label).toBe('2026/27')
    expect(getTaxYearForDate('2027-03-03').label).toBe('2026/27')
  })

  it('maps dates on or after 6 April to the next tax year', () => {
    expect(getTaxYearForDate('2027-04-10').label).toBe('2027/28')
    expect(getTaxYearForDate('2027-04-06').label).toBe('2027/28')
  })

  it('maps 5 April to the previous tax year', () => {
    expect(getTaxYearForDate('2027-04-05').label).toBe('2026/27')
  })
})

describe('getQuarterForDate', () => {
  it('returns Q2 for 18 July 2026', () => {
    expect(getQuarterForDate('2026-07-18').id).toBe('Q2')
    expect(getQuarterForDate('2026-07-18').taxYearStart).toBe('2026-04-06')
  })

  it.each([
    ['2026-04-06', 'Q1'],
    ['2026-07-05', 'Q1'],
    ['2026-07-06', 'Q2'],
    ['2026-10-05', 'Q2'],
    ['2026-10-06', 'Q3'],
    ['2027-01-05', 'Q3'],
    ['2027-01-06', 'Q4'],
    ['2027-04-05', 'Q4'],
  ] as const)('maps %s to %s at quarter period boundaries', (isoDate, quarterId) => {
    expect(getQuarterForDate(isoDate).id).toBe(quarterId)
    expect(getQuarterForDate(isoDate).taxYearStart).toBe('2026-04-06')
  })
})

describe('isDateInQuarter boundaries', () => {
  const q1 = getQuarterInfo('Q1', '2026-04-06')

  it.each([
    ['2026-04-05', false],
    ['2026-04-06', true],
    ['2026-07-05', true],
    ['2026-07-06', false],
  ] as const)('isDateInQuarter(%s) is %s for Q1 2026/27', (isoDate, expected) => {
    expect(isDateInQuarter(isoDate, q1)).toBe(expected)
  })
})

describe('isDateInTaxYear boundaries', () => {
  const taxYearStart = '2026-04-06'

  it.each([
    ['2026-04-05', false],
    ['2026-04-06', true],
    ['2027-04-05', true],
    ['2027-04-06', false],
  ] as const)('isDateInTaxYear(%s) is %s for 2026/27', (isoDate, expected) => {
    expect(isDateInTaxYear(isoDate, taxYearStart)).toBe(expected)
  })
})

describe('isDateInHmrcUpdatePeriod boundaries', () => {
  const q2 = getQuarterInfo('Q2', '2026-04-06')

  it.each([
    ['2026-04-05', false],
    ['2026-04-06', true],
    ['2026-10-05', true],
    ['2026-10-06', false],
  ] as const)(
    'isDateInHmrcUpdatePeriod(%s) is %s for Q2 cumulative period',
    (isoDate, expected) => {
      expect(isDateInHmrcUpdatePeriod(isoDate, q2)).toBe(expected)
    },
  )
})

describe('parseQuarterId', () => {
  it.each(['Q1', 'Q2', 'Q3', 'Q4'] as const)('accepts %s', (quarterId) => {
    expect(parseQuarterId(quarterId)).toBe(quarterId)
  })

  it.each(['q1', 'Q5', '', 'Q1 ', null, undefined] as const)(
    'rejects invalid %s',
    (value) => {
      expect(parseQuarterId(value)).toBeNull()
    },
  )
})

describe('parseTaxYearStart', () => {
  it('accepts a valid tax year start date', () => {
    expect(parseTaxYearStart('2026-04-06')).toBe('2026-04-06')
  })

  it.each(['2026-04-05', '2026/04/06', 'not-a-date', '', null, undefined] as const)(
    'rejects invalid %s',
    (value) => {
      expect(parseTaxYearStart(value)).toBeNull()
    },
  )
})

describe('usesCumulativeHmrcSubmission', () => {
  it.each([
    ['2024-04-06', false],
    ['2025-04-06', true],
    ['2026-04-06', true],
  ] as const)('for tax year %s returns %s', (taxYearStart, expected) => {
    expect(usesCumulativeHmrcSubmission(taxYearStart)).toBe(expected)
  })
})

describe('getQuartersForTaxYear', () => {
  it('uses standard HMRC quarter ends and deadlines for 2026/27', () => {
    const quarters = getQuartersForTaxYear('2026-04-06')

    expect(quarters.map((quarter) => quarter.periodEnd)).toEqual([
      '2026-07-05',
      '2026-10-05',
      '2027-01-05',
      '2027-04-05',
    ])

    expect(quarters.map((quarter) => quarter.deadline)).toEqual([
      '2026-08-07',
      '2026-11-07',
      '2027-02-07',
      '2027-05-07',
    ])
  })

  it('shows cumulative HMRC update periods from tax year start', () => {
    const q2 = getQuartersForTaxYear('2026-04-06')[1]!
    expect(q2.hmrcUpdatePeriodLabel).toContain('6 Apr 2026')
    expect(q2.hmrcUpdatePeriodLabel).toContain('5 Oct 2026')
  })
})

describe('getCurrentQuarter', () => {
  it('returns Q1 before first quarter ends', () => {
    const quarter = getCurrentQuarter(new Date('2026-06-01T12:00:00'))
    expect(quarter.id).toBe('Q1')
  })
})

describe('getFinalDeclarationDeadline', () => {
  it('returns 31 January two years after tax year start', () => {
    expect(getFinalDeclarationDeadline('2026-04-06')).toBe('2028-01-31')
  })
})

describe('listAvailableTaxYears', () => {
  it('includes current and previous tax years', () => {
    const years = listAvailableTaxYears({
      fromTaxYearStart: '2024-04-06',
      throughTaxYearStart: '2026-04-06',
    })

    expect(years.map((year) => year.label)).toEqual(['2026/27', '2025/26', '2024/25'])
  })
})
