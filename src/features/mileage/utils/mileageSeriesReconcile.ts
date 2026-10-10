import { shiftIsoDate, uniqueSortedIsoDates } from '~/features/mileage/utils/isoDates'

export type ExistingSeriesEntry = {
  id: string
  date: string
  seriesOverride: boolean
}

export type MileageSeriesReconcilePlan = {
  datesToInsert: string[]
  entriesToUpdate: ExistingSeriesEntry[]
  entriesToDelete: ExistingSeriesEntry[]
}

export function planSeriesReconcile(input: {
  nextDates: string[]
  existingEntries: ExistingSeriesEntry[]
}): MileageSeriesReconcilePlan {
  const nextSet = new Set(input.nextDates)
  const occupiedDates = new Set<string>()
  const entriesToUpdate: ExistingSeriesEntry[] = []
  const entriesToDelete: ExistingSeriesEntry[] = []

  for (const entry of input.existingEntries) {
    if (entry.seriesOverride) {
      occupiedDates.add(entry.date)
      continue
    }

    if (nextSet.has(entry.date)) {
      entriesToUpdate.push(entry)
      occupiedDates.add(entry.date)
    } else {
      entriesToDelete.push(entry)
    }
  }

  return {
    datesToInsert: input.nextDates.filter((date) => !occupiedDates.has(date)),
    entriesToUpdate,
    entriesToDelete,
  }
}

export function addExceptionDate(dates: string[], isoDate: string): string[] {
  return uniqueSortedIsoDates([...dates, isoDate])
}

export function removeExceptionDate(dates: string[], isoDate: string): string[] {
  return dates.filter((date) => date !== isoDate)
}

export function splitSeriesBoundary(fromDate: string): {
  oldEndDate: string
  newStartDate: string
} {
  return {
    oldEndDate: shiftIsoDate(fromDate, -1),
    newStartDate: fromDate,
  }
}

export function entriesOnOrAfter<T extends { date: string }>(
  entries: T[],
  fromDate: string,
): T[] {
  return entries.filter((entry) => entry.date >= fromDate)
}

export function entriesBefore<T extends { date: string }>(
  entries: T[],
  fromDate: string,
): T[] {
  return entries.filter((entry) => entry.date < fromDate)
}
