import { describe, expect, it } from 'vitest'

import { assessManualEntryDate } from '~/features/mtd/utils/assessManualEntryDate'
import { getQuarterInfo } from '~/features/mtd/utils/quarterPeriods'

describe('assessManualEntryDate', () => {
  const currentQ2 = getQuarterInfo('Q2', '2026-04-06')

  it('allows dates in the current quarter', () => {
    expect(
      assessManualEntryDate('2026-08-01', {
        currentQuarter: currentQ2,
        dateQuarterSubmitted: false,
      }).action,
    ).toBe('allow')
  })

  it('treats May as Q1 when the current period is Q2', () => {
    const result = assessManualEntryDate('2026-05-23', {
      currentQuarter: currentQ2,
      dateQuarterSubmitted: false,
    })
    expect(result.action).toBe('confirm')
    if (result.action === 'confirm') {
      expect(result.quarter.id).toBe('Q1')
      expect(result.title).toMatch(/Outside current period/i)
      expect(result.description).toMatch(/Q1/)
      expect(result.description).toMatch(/Q2/)
    }
  })

  it('blocks dates in a submitted quarter', () => {
    const result = assessManualEntryDate('2026-05-23', {
      currentQuarter: currentQ2,
      dateQuarterSubmitted: true,
    })
    expect(result.action).toBe('block')
    if (result.action === 'block') {
      expect(result.quarter.id).toBe('Q1')
      expect(result.title).toMatch(/submitted/i)
    }
  })

  it('asks to confirm dates in an unsubmitted other tax year', () => {
    const result = assessManualEntryDate('2025-05-23', {
      currentQuarter: currentQ2,
      dateQuarterSubmitted: false,
    })
    expect(result.action).toBe('confirm')
    if (result.action === 'confirm') {
      expect(result.quarter.taxYearStart).toBe('2025-04-06')
      expect(result.description).toMatch(/Add it anyway/i)
    }
  })

  it.each([currentQ2.periodStart, currentQ2.periodEnd] as const)(
    'allows dates on the current quarter boundary (%s)',
    (isoDate) => {
      expect(
        assessManualEntryDate(isoDate, {
          currentQuarter: currentQ2,
          dateQuarterSubmitted: false,
        }).action,
      ).toBe('allow')
    },
  )

  it('confirms the last day of the previous quarter in the same tax year', () => {
    const result = assessManualEntryDate('2026-07-05', {
      currentQuarter: currentQ2,
      dateQuarterSubmitted: false,
    })
    expect(result.action).toBe('confirm')
    if (result.action === 'confirm') {
      expect(result.quarter.id).toBe('Q1')
    }
  })

  it('allows the first day of the current quarter', () => {
    expect(
      assessManualEntryDate('2026-07-06', {
        currentQuarter: currentQ2,
        dateQuarterSubmitted: false,
      }).action,
    ).toBe('allow')
  })

  it('blocks the previous quarter boundary when that quarter was submitted', () => {
    const result = assessManualEntryDate('2026-07-05', {
      currentQuarter: currentQ2,
      dateQuarterSubmitted: true,
    })
    expect(result.action).toBe('block')
    if (result.action === 'block') {
      expect(result.quarter.id).toBe('Q1')
    }
  })
})
