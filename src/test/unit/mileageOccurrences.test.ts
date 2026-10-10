import { describe, expect, it } from 'vitest'

import {
  generateMileageOccurrences,
  validateMileageSeriesInput,
} from '~/features/mileage/utils/mileageOccurrences'
import { previewMileageSeriesClaim } from '~/features/mileage/utils/mileageSeriesPreview'
import {
  addExceptionDate,
  planSeriesReconcile,
  splitSeriesBoundary,
} from '~/features/mileage/utils/mileageSeriesReconcile'
import { getEnglandWalesBankHolidays } from '~/features/mileage/utils/ukBankHolidays'
import { formatMileageJourneyDescription } from '~/features/mileage/utils/mileageSeriesFormat'

const weekdaySeries = {
  recurrenceType: 'weekly' as const,
  selectedWeekdays: [1, 2, 3, 4, 5],
  startDate: '2026-04-06',
  endDate: '2026-04-17',
}

describe('generateMileageOccurrences', () => {
  it('generates monday to friday journeys inside the date range', () => {
    expect(generateMileageOccurrences(weekdaySeries)).toEqual([
      '2026-04-06',
      '2026-04-07',
      '2026-04-08',
      '2026-04-09',
      '2026-04-10',
      '2026-04-13',
      '2026-04-14',
      '2026-04-15',
      '2026-04-16',
      '2026-04-17',
    ])
  })

  it('includes the start and end dates when they match the recurrence', () => {
    const dates = generateMileageOccurrences({
      ...weekdaySeries,
      startDate: '2026-04-06',
      endDate: '2026-04-10',
    })

    expect(dates[0]).toBe('2026-04-06')
    expect(dates.at(-1)).toBe('2026-04-10')
    expect(dates).toHaveLength(5)
  })

  it('omits weekends on a weekday series even when they sit inside the range', () => {
    const dates = generateMileageOccurrences(weekdaySeries)
    expect(dates).not.toContain('2026-04-11')
    expect(dates).not.toContain('2026-04-12')
  })

  it('subtracts excluded dates that match the recurrence', () => {
    expect(
      generateMileageOccurrences({
        ...weekdaySeries,
        excludedDates: ['2026-04-10', '2026-04-11'],
      }),
    ).toEqual([
      '2026-04-06',
      '2026-04-07',
      '2026-04-08',
      '2026-04-09',
      '2026-04-13',
      '2026-04-14',
      '2026-04-15',
      '2026-04-16',
      '2026-04-17',
    ])
  })

  it('does not resurrect deleted occurrences', () => {
    expect(
      generateMileageOccurrences({
        ...weekdaySeries,
        deletedDates: ['2026-04-08'],
      }),
    ).not.toContain('2026-04-08')
  })

  it('clamps monthly recurrence to the last day of shorter months', () => {
    expect(
      generateMileageOccurrences({
        recurrenceType: 'monthly',
        selectedWeekdays: [],
        startDate: '2026-01-31',
        endDate: '2026-03-31',
      }),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })

  it('generates every day for a daily series', () => {
    expect(
      generateMileageOccurrences({
        recurrenceType: 'daily',
        selectedWeekdays: [],
        startDate: '2026-04-10',
        endDate: '2026-04-12',
      }),
    ).toEqual(['2026-04-10', '2026-04-11', '2026-04-12'])
  })

  it('stops after the occurrence cap instead of walking a huge date range', () => {
    const dates = generateMileageOccurrences({
      recurrenceType: 'daily',
      selectedWeekdays: [],
      startDate: '2026-01-01',
      endDate: '9999-12-31',
    })

    expect(dates).toHaveLength(501)
    expect(dates[0]).toBe('2026-01-01')
    expect(dates.at(-1)).toBe('2027-05-16')
  })
})

describe('validateMileageSeriesInput', () => {
  it('rejects weekly recurrence with no weekdays', () => {
    expect(
      validateMileageSeriesInput({
        journeyDetails: 'Client site',
        milesPerJourney: 32,
        recurrenceType: 'weekly',
        selectedWeekdays: [],
        startDate: '2026-04-06',
        endDate: '2026-04-17',
      }),
    ).toBe('weekly_no_weekdays')
  })

  it('rejects a series that generates no journeys', () => {
    expect(
      validateMileageSeriesInput({
        journeyDetails: 'Client site',
        milesPerJourney: 32,
        recurrenceType: 'weekly',
        selectedWeekdays: [6, 7],
        startDate: '2026-04-06',
        endDate: '2026-04-10',
      }),
    ).toBe('zero_journeys')
  })

  it('rejects end dates before the start date', () => {
    expect(
      validateMileageSeriesInput({
        journeyDetails: 'Client site',
        milesPerJourney: 32,
        recurrenceType: 'daily',
        selectedWeekdays: [],
        startDate: '2026-04-10',
        endDate: '2026-04-01',
      }),
    ).toBe('end_before_start')
  })
})

describe('uk bank holidays', () => {
  it('uses substitute weekdays when christmas falls on a sunday', () => {
    const holidays = getEnglandWalesBankHolidays(2022)
    expect(holidays).toContain('2022-12-26')
    expect(holidays).toContain('2022-12-27')
    expect(holidays).not.toContain('2022-12-25')
  })

  it('includes easter monday 2026', () => {
    expect(getEnglandWalesBankHolidays(2026)).toContain('2026-04-06')
  })
})

describe('planSeriesReconcile', () => {
  it('updates matching generated entries and inserts new dates', () => {
    const plan = planSeriesReconcile({
      nextDates: ['2026-04-06', '2026-04-07', '2026-04-08'],
      existingEntries: [
        { id: 'a', date: '2026-04-06', seriesOverride: false },
        { id: 'b', date: '2026-04-07', seriesOverride: false },
      ],
    })

    expect(plan.entriesToUpdate.map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(plan.datesToInsert).toEqual(['2026-04-08'])
    expect(plan.entriesToDelete).toEqual([])
  })

  it('does not overwrite a single-entry override', () => {
    const plan = planSeriesReconcile({
      nextDates: ['2026-04-06', '2026-04-07'],
      existingEntries: [
        { id: 'override', date: '2026-04-06', seriesOverride: true },
        { id: 'generated', date: '2026-04-07', seriesOverride: false },
      ],
    })

    expect(plan.entriesToUpdate.map((entry) => entry.id)).toEqual(['generated'])
    expect(plan.datesToInsert).toEqual([])
    expect(plan.entriesToDelete).toEqual([])
  })

  it('does not resurrect excluded or deleted dates', () => {
    const dates = generateMileageOccurrences({
      ...weekdaySeries,
      excludedDates: ['2026-04-10'],
      deletedDates: ['2026-04-09'],
    })

    const plan = planSeriesReconcile({
      nextDates: dates,
      existingEntries: [{ id: 'kept', date: '2026-04-06', seriesOverride: false }],
    })

    expect(plan.datesToInsert).not.toContain('2026-04-09')
    expect(plan.datesToInsert).not.toContain('2026-04-10')
  })

  it('deletes generated entries that left the recurrence without adding them as exceptions', () => {
    const plan = planSeriesReconcile({
      nextDates: ['2026-04-06', '2026-04-07'],
      existingEntries: [
        { id: 'keep', date: '2026-04-06', seriesOverride: false },
        { id: 'gone', date: '2026-04-08', seriesOverride: false },
      ],
    })

    expect(plan.entriesToDelete.map((entry) => entry.id)).toEqual(['gone'])
  })
})

describe('this-and-future split and deleted occurrences', () => {
  it('ends the previous series the day before the split', () => {
    expect(splitSeriesBoundary('2026-10-01')).toEqual({
      oldEndDate: '2026-09-30',
      newStartDate: '2026-10-01',
    })
  })

  it('keeps a deleted occurrence out of later regeneration', () => {
    const deletedDates = addExceptionDate([], '2026-04-08')
    const regenerated = generateMileageOccurrences({
      ...weekdaySeries,
      deletedDates,
    })

    expect(regenerated).not.toContain('2026-04-08')
    expect(regenerated).toContain('2026-04-07')
  })
})

describe('previewMileageSeriesClaim', () => {
  it('uses existing tax-year mileage when estimating the claim', () => {
    const preview = previewMileageSeriesClaim({
      dates: ['2026-08-01', '2026-08-02'],
      milesPerJourney: 20,
      existingEntries: [
        {
          id: 'existing',
          date: '2026-06-01',
          miles: 9_990,
          journeyDetails: 'Earlier',
          createdAt: '2026-06-01T10:00:00.000Z',
          updatedAt: '2026-06-01T10:00:00.000Z',
        },
      ],
    })

    expect(preview.journeyCount).toBe(2)
    expect(preview.totalMiles).toBe(40)
    expect(preview.claimPounds).toBe(13)
  })
})

describe('formatMileageJourneyDescription', () => {
  it('joins from and to with an arrow', () => {
    expect(formatMileageJourneyDescription('Home', 'Client site, Sheffield')).toBe(
      'Home → Client site, Sheffield',
    )
  })

  it('falls back to the to location when from is empty', () => {
    expect(formatMileageJourneyDescription('  ', 'Office')).toBe('Office')
  })
})
