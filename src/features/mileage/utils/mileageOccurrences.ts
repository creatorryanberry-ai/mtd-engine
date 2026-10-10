import {
  clampMonthDay,
  isIsoDate,
  isoWeekday,
  shiftIsoDate,
  uniqueSortedIsoDates,
} from '~/features/mileage/utils/isoDates'

export const MAX_MILEAGE_OCCURRENCES = 500

export const MILEAGE_RECURRENCE_TYPES = ['daily', 'weekly', 'monthly'] as const

export type MileageRecurrenceType = (typeof MILEAGE_RECURRENCE_TYPES)[number]

export const ISO_WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 7, label: 'Sun' },
] as const

export const DEFAULT_WEEKLY_WEEKDAYS = [1, 2, 3, 4, 5]

export type MileageSeriesOccurrenceInput = {
  recurrenceType: MileageRecurrenceType
  selectedWeekdays: number[]
  startDate: string
  endDate: string
  excludedDates?: string[]
  deletedDates?: string[]
}

export type MileageSeriesValidationIssue =
  | 'missing_details'
  | 'no_mileage'
  | 'zero_mileage'
  | 'invalid_dates'
  | 'end_before_start'
  | 'weekly_no_weekdays'
  | 'zero_journeys'
  | 'too_many_journeys'

export const MILEAGE_SERIES_VALIDATION_MESSAGES: Record<
  MileageSeriesValidationIssue,
  string
> = {
  missing_details: 'Enter where you went',
  no_mileage: 'Enter the miles per journey',
  zero_mileage: 'Mileage must be greater than zero',
  invalid_dates: 'Choose a start and end date',
  end_before_start: 'End date must be on or after the start date',
  weekly_no_weekdays: 'Select at least one weekday',
  zero_journeys: 'This repeat pattern does not create any journeys in the date range',
  too_many_journeys:
    'This series would create too many journeys. Shorten the date range.',
}

export function parseJsonStringArray(value: string | null | undefined): string[] {
  if (!value?.trim()) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return uniqueSortedIsoDates(
      parsed.filter((item): item is string => typeof item === 'string'),
    )
  } catch {
    return []
  }
}

export function parseWeekdayList(value: string | null | undefined): number[] {
  if (!value?.trim()) return []

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return [
      ...new Set(
        parsed.filter(
          (item): item is number =>
            typeof item === 'number' && Number.isInteger(item) && item >= 1 && item <= 7,
        ),
      ),
    ].sort((left, right) => left - right)
  } catch {
    return []
  }
}

export function serializeJsonList(value: unknown[]): string {
  return JSON.stringify(value)
}

export function normalizeWeekdays(weekdays: number[]): number[] {
  return [
    ...new Set(
      weekdays.filter((item) => Number.isInteger(item) && item >= 1 && item <= 7),
    ),
  ].sort((left, right) => left - right)
}

export function formatWeekdaySummary(weekdays: number[]): string {
  const sorted = normalizeWeekdays(weekdays)
  if (sorted.length === 0) return ''
  if (sorted.join(',') === '1,2,3,4,5') return 'Mon–Fri'
  if (sorted.join(',') === '1,2,3,4,5,6,7') return 'Every day'
  return sorted
    .map((weekday) => ISO_WEEKDAY_OPTIONS[weekday - 1]?.label ?? '')
    .filter(Boolean)
    .join(', ')
}

function monthlyOccurrenceInMonth(startDate: string, isoDate: string): string {
  const dayOfMonth = Number.parseInt(startDate.slice(8, 10), 10)
  const year = Number.parseInt(isoDate.slice(0, 4), 10)
  const month = Number.parseInt(isoDate.slice(5, 7), 10)
  return clampMonthDay(year, month, dayOfMonth)
}

export function matchesRecurrence(
  isoDate: string,
  series: Pick<
    MileageSeriesOccurrenceInput,
    'recurrenceType' | 'selectedWeekdays' | 'startDate' | 'endDate'
  >,
): boolean {
  if (!isIsoDate(isoDate) || isoDate < series.startDate || isoDate > series.endDate) {
    return false
  }

  if (series.recurrenceType === 'daily') return true

  if (series.recurrenceType === 'weekly') {
    return normalizeWeekdays(series.selectedWeekdays).includes(isoWeekday(isoDate))
  }

  return monthlyOccurrenceInMonth(series.startDate, isoDate) === isoDate
}

function datesMatchingRecurrence(series: MileageSeriesOccurrenceInput): string[] {
  if (!isIsoDate(series.startDate) || !isIsoDate(series.endDate)) return []
  if (series.endDate < series.startDate) return []

  if (series.recurrenceType === 'monthly') {
    const dayOfMonth = Number.parseInt(series.startDate.slice(8, 10), 10)
    const dates: string[] = []
    let year = Number.parseInt(series.startDate.slice(0, 4), 10)
    let month = Number.parseInt(series.startDate.slice(5, 7), 10)

    while (true) {
      const date = clampMonthDay(year, month, dayOfMonth)
      if (date > series.endDate) break
      if (date >= series.startDate) dates.push(date)
      if (dates.length > MAX_MILEAGE_OCCURRENCES) break
      month += 1
      if (month > 12) {
        month = 1
        year += 1
      }
    }

    return dates
  }

  const weekdays = new Set(normalizeWeekdays(series.selectedWeekdays))
  const dates: string[] = []
  let cursor = series.startDate
  let walked = 0
  const maxWalkDays = (MAX_MILEAGE_OCCURRENCES + 1) * 7
  while (cursor <= series.endDate && walked <= maxWalkDays) {
    const matches = series.recurrenceType === 'daily' || weekdays.has(isoWeekday(cursor))
    if (matches) {
      dates.push(cursor)
      if (dates.length > MAX_MILEAGE_OCCURRENCES) break
    }
    cursor = shiftIsoDate(cursor, 1)
    walked += 1
  }
  return dates
}

export function generateMileageOccurrences(
  series: MileageSeriesOccurrenceInput,
): string[] {
  const excluded = new Set([
    ...uniqueSortedIsoDates(series.excludedDates ?? []),
    ...uniqueSortedIsoDates(series.deletedDates ?? []),
  ])

  return datesMatchingRecurrence(series).filter((date) => !excluded.has(date))
}

export function validateMileageSeriesInput(input: {
  journeyDetails?: string
  milesPerJourney?: number | null
  recurrenceType: MileageRecurrenceType
  selectedWeekdays: number[]
  startDate: string
  endDate: string
  excludedDates?: string[]
  deletedDates?: string[]
}): MileageSeriesValidationIssue | null {
  if (!input.journeyDetails?.trim()) return 'missing_details'
  if (input.milesPerJourney == null) return 'no_mileage'
  if (!Number.isFinite(input.milesPerJourney) || input.milesPerJourney <= 0) {
    return 'zero_mileage'
  }
  if (!isIsoDate(input.startDate) || !isIsoDate(input.endDate)) return 'invalid_dates'
  if (input.endDate < input.startDate) return 'end_before_start'
  if (
    input.recurrenceType === 'weekly' &&
    normalizeWeekdays(input.selectedWeekdays).length === 0
  ) {
    return 'weekly_no_weekdays'
  }

  const dates = generateMileageOccurrences(input)
  if (dates.length === 0) return 'zero_journeys'
  if (dates.length > MAX_MILEAGE_OCCURRENCES) return 'too_many_journeys'
  return null
}

export function filterDatesToRecurrence(
  dates: string[],
  series: MileageSeriesOccurrenceInput,
): string[] {
  return uniqueSortedIsoDates(dates).filter((date) => matchesRecurrence(date, series))
}
