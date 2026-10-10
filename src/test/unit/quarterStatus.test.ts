import { describe, expect, it } from 'vitest'

import {
  addDays,
  getQuarterInfo,
  getQuartersForTaxYear,
} from '~/features/mtd/utils/quarterPeriods'
import {
  deriveQuarterStatus,
  deriveYearEndStatus,
  getActiveQuarter,
} from '~/features/mtd/utils/quarterStatus'

describe('deriveQuarterStatus', () => {
  const q1 = getQuartersForTaxYear('2026-04-06')[0]!

  it('marks submitted quarters', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: '2026-08-01',
        submitted: true,
        isReady: true,
        toReview: 0,
      }),
    ).toBe('submitted')
  })

  it('marks overdue when past deadline and not submitted', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: '2026-08-08',
        submitted: false,
        isReady: false,
        toReview: 3,
      }),
    ).toBe('overdue')
  })

  it('marks ready to submit when blockers are clear', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: '2026-07-10',
        submitted: false,
        isReady: true,
        toReview: 0,
      }),
    ).toBe('readyToSubmit')
  })

  it('marks upcoming before the quarter starts', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: '2026-04-05',
        submitted: false,
        isReady: false,
        toReview: 0,
      }),
    ).toBe('upcoming')
  })

  it('marks current on the first day of the quarter', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: q1.periodStart,
        submitted: false,
        isReady: false,
        toReview: 0,
      }),
    ).toBe('current')
  })

  it('opens the review window exactly ten days before period end', () => {
    const earlySubmitDay = addDays(q1.periodEnd, -10)
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: earlySubmitDay,
        submitted: false,
        isReady: false,
        toReview: 0,
      }),
    ).toBe('readyForReview')
  })

  it('stays current the day before the early submit window opens', () => {
    const dayBeforeEarlySubmit = addDays(q1.periodEnd, -11)
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: dayBeforeEarlySubmit,
        submitted: false,
        isReady: false,
        toReview: 0,
      }),
    ).toBe('current')
  })

  it('marks ready for review after period end when nothing is left to review', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: q1.periodEnd,
        submitted: false,
        isReady: false,
        toReview: 0,
      }),
    ).toBe('readyForReview')
  })

  it('marks review required when transactions remain to review', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: '2026-07-10',
        submitted: false,
        isReady: false,
        toReview: 2,
      }),
    ).toBe('reviewRequired')
  })

  it('marks review required when reviewComplete is explicitly false', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: '2026-07-10',
        submitted: false,
        isReady: false,
        toReview: 0,
        reviewComplete: false,
      }),
    ).toBe('reviewRequired')
  })

  it('is not overdue on the deadline day itself', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: q1.deadline,
        submitted: false,
        isReady: false,
        toReview: 1,
      }),
    ).toBe('reviewRequired')
  })

  it('becomes overdue the day after the deadline', () => {
    expect(
      deriveQuarterStatus({
        quarter: q1,
        today: addDays(q1.deadline, 1),
        submitted: false,
        isReady: true,
        toReview: 0,
      }),
    ).toBe('overdue')
  })
})

describe('getActiveQuarter', () => {
  it('prioritises unsubmitted quarter with ended period over current calendar quarter', () => {
    const active = getActiveQuarter({
      taxYearStart: '2026-04-06',
      today: '2026-07-10',
      submittedQuarterIds: new Set(),
    })

    expect(active.id).toBe('Q1')
  })

  it('moves to next quarter after Q1 is submitted', () => {
    const active = getActiveQuarter({
      taxYearStart: '2026-04-06',
      today: '2026-07-10',
      submittedQuarterIds: new Set(['Q1']),
    })

    expect(active.id).toBe('Q2')
  })

  it('selects the obligation quarter when it is still unsubmitted', () => {
    const q2 = getQuarterInfo('Q2', '2026-04-06')
    const active = getActiveQuarter({
      taxYearStart: '2026-04-06',
      today: '2026-08-01',
      submittedQuarterIds: new Set(['Q1']),
      obligationPeriodEnd: q2.periodEnd,
    })

    expect(active.id).toBe('Q2')
  })

  it('ignores a submitted obligation quarter and falls back to the next open quarter', () => {
    const q1 = getQuarterInfo('Q1', '2026-04-06')
    const active = getActiveQuarter({
      taxYearStart: '2026-04-06',
      today: '2026-08-01',
      submittedQuarterIds: new Set(['Q1']),
      obligationPeriodEnd: q1.periodEnd,
    })

    expect(active.id).toBe('Q2')
  })

  it('activates a quarter on the first day of its early submit window', () => {
    const q1 = getQuarterInfo('Q1', '2026-04-06')
    const active = getActiveQuarter({
      taxYearStart: '2026-04-06',
      today: addDays(q1.periodEnd, -10),
      submittedQuarterIds: new Set(),
    })

    expect(active.id).toBe('Q1')
  })

  it('falls back to the calendar quarter when every quarter is submitted', () => {
    const active = getActiveQuarter({
      taxYearStart: '2026-04-06',
      today: '2026-08-01',
      submittedQuarterIds: new Set(['Q1', 'Q2', 'Q3', 'Q4']),
    })

    expect(active.id).toBe('Q2')
  })
})

describe('deriveYearEndStatus', () => {
  it('is available before tax year end (demo unlock)', () => {
    expect(
      deriveYearEndStatus({
        taxYearStart: '2026-04-06',
        taxYearEnd: '2027-04-05',
        today: '2027-03-01',
      }),
    ).toBe('available')
  })

  it('is available after tax year end', () => {
    expect(
      deriveYearEndStatus({
        taxYearStart: '2026-04-06',
        taxYearEnd: '2027-04-05',
        today: '2027-04-06',
      }),
    ).toBe('available')
  })

  it('is completed when marked complete', () => {
    expect(
      deriveYearEndStatus({
        taxYearStart: '2026-04-06',
        taxYearEnd: '2027-04-05',
        today: '2027-03-01',
        completed: true,
      }),
    ).toBe('completed')
  })
})
