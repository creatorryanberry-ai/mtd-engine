import { and, desc, eq, inArray } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { mileageEntry, mileageSeries } from '~/database/schema'
import {
  generateMileageOccurrences,
  MILEAGE_SERIES_VALIDATION_MESSAGES,
  normalizeWeekdays,
  parseJsonStringArray,
  parseWeekdayList,
  serializeJsonList,
  validateMileageSeriesInput,
} from '~/features/mileage/utils/mileageOccurrences'
import { uniqueSortedIsoDates } from '~/features/mileage/utils/isoDates'
import { enrichMileageEntriesWithClaims } from '~/features/mileage/utils/mileageClaim'
import {
  entriesOnOrAfter,
  planSeriesReconcile,
  splitSeriesBoundary,
} from '~/features/mileage/utils/mileageSeriesReconcile'

import type {
  MileageSeriesDto,
  MileageSeriesWriteInput,
} from '~/features/mileage/mileageSeriesTypes'

export type MileageSeriesRecord = typeof mileageSeries.$inferSelect
type MileageEntryRecord = typeof mileageEntry.$inferSelect

type DecodedSeries = MileageSeriesWriteInput & {
  id: string
  userId: string
  deletedDates: string[]
  active: boolean
  createdAt: string
  updatedAt: string
}

function formatMileageSeriesDbError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  if (/mileageSeries/i.test(message) && /does not exist/i.test(message)) {
    return 'Mileage series table is missing. Run bun backend:migrate and try again.'
  }
  if (/column .*seriesId/i.test(message) && /does not exist/i.test(message)) {
    return 'Mileage series columns are missing. Run bun backend:migrate and try again.'
  }
  return message || fallback
}

function parseRecurrenceType(value: string): MileageSeriesWriteInput['recurrenceType'] {
  if (value === 'daily' || value === 'weekly' || value === 'monthly') return value
  throw new Error('Repeat must be daily, weekly, or monthly')
}

function decodeSeries(row: MileageSeriesRecord): DecodedSeries {
  return {
    id: row.id,
    userId: row.userId,
    fromLocation: row.fromLocation,
    journeyDetails: row.journeyDetails,
    milesPerJourney: row.milesPerJourney,
    includesReturnJourney: row.includesReturnJourney,
    recurrenceType: parseRecurrenceType(row.recurrenceType),
    selectedWeekdays: parseWeekdayList(row.selectedWeekdays),
    startDate: row.startDate,
    endDate: row.endDate,
    excludedDates: parseJsonStringArray(row.excludedDates),
    deletedDates: parseJsonStringArray(row.deletedDates),
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function occurrenceInput(series: {
  recurrenceType: MileageSeriesWriteInput['recurrenceType']
  selectedWeekdays: number[]
  startDate: string
  endDate: string
  excludedDates: string[]
  deletedDates: string[]
}) {
  return {
    recurrenceType: series.recurrenceType,
    selectedWeekdays: series.selectedWeekdays,
    startDate: series.startDate,
    endDate: series.endDate,
    excludedDates: series.excludedDates,
    deletedDates: series.deletedDates,
  }
}

function validateWriteInput(input: MileageSeriesWriteInput, deletedDates: string[] = []) {
  const issue = validateMileageSeriesInput({
    journeyDetails: input.journeyDetails,
    milesPerJourney: input.milesPerJourney,
    recurrenceType: input.recurrenceType,
    selectedWeekdays: input.selectedWeekdays,
    startDate: input.startDate,
    endDate: input.endDate,
    excludedDates: input.excludedDates,
    deletedDates,
  })
  if (issue) {
    throw new Error(MILEAGE_SERIES_VALIDATION_MESSAGES[issue])
  }
}

function seriesValues(input: MileageSeriesWriteInput, deletedDates: string[]) {
  return {
    fromLocation: input.fromLocation?.trim() || null,
    journeyDetails: input.journeyDetails.trim(),
    milesPerJourney: input.milesPerJourney,
    includesReturnJourney: input.includesReturnJourney,
    recurrenceType: input.recurrenceType,
    selectedWeekdays: serializeJsonList(normalizeWeekdays(input.selectedWeekdays)),
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    excludedDates: serializeJsonList(uniqueSortedIsoDates(input.excludedDates)),
    deletedDates: serializeJsonList(uniqueSortedIsoDates(deletedDates)),
  }
}

function datesInRange(dates: string[], startDate: string, endDate: string) {
  return dates.filter((date) => date >= startDate && date <= endDate)
}

async function listEntriesForUser(userId: string): Promise<MileageEntryRecord[]> {
  return drizzle.select().from(mileageEntry).where(eq(mileageEntry.userId, userId))
}

function toSeriesDto(
  series: DecodedSeries,
  entries: MileageEntryRecord[],
): MileageSeriesDto {
  const enriched = enrichMileageEntriesWithClaims(entries)
  const seriesEntries = enriched.filter((entry) => entry.seriesId === series.id)
  const totalMiles = seriesEntries.reduce((sum, entry) => sum + entry.miles, 0)
  const claimPounds = seriesEntries.reduce(
    (sum, entry) => sum + entry.claim.claimPounds,
    0,
  )

  return {
    id: series.id,
    fromLocation: series.fromLocation,
    journeyDetails: series.journeyDetails,
    milesPerJourney: series.milesPerJourney,
    includesReturnJourney: series.includesReturnJourney,
    recurrenceType: series.recurrenceType,
    selectedWeekdays: series.selectedWeekdays,
    startDate: series.startDate,
    endDate: series.endDate,
    excludedDates: series.excludedDates,
    deletedDates: series.deletedDates,
    active: series.active,
    createdAt: series.createdAt,
    updatedAt: series.updatedAt,
    journeyCount: seriesEntries.length,
    totalMiles,
    claimPounds,
  }
}

async function requireSeries(userId: string, seriesId: string) {
  const [row] = await drizzle
    .select()
    .from(mileageSeries)
    .where(and(eq(mileageSeries.id, seriesId), eq(mileageSeries.userId, userId)))
    .limit(1)

  if (!row) {
    throw new Error('Mileage series not found')
  }

  return decodeSeries(row)
}

function generatedEntryValues(input: {
  userId: string
  seriesId: string
  date: string
  journeyDetails: string
  miles: number
  now: string
}) {
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    date: input.date,
    journeyDetails: input.journeyDetails,
    miles: input.miles,
    seriesId: input.seriesId,
    seriesOverride: false,
    createdAt: input.now,
    updatedAt: input.now,
  }
}

async function insertGeneratedEntries(input: {
  userId: string
  seriesId: string
  dates: string[]
  journeyDetails: string
  miles: number
  now: string
}) {
  if (input.dates.length === 0) return

  await drizzle.insert(mileageEntry).values(
    input.dates.map((date) =>
      generatedEntryValues({
        userId: input.userId,
        seriesId: input.seriesId,
        date,
        journeyDetails: input.journeyDetails,
        miles: input.miles,
        now: input.now,
      }),
    ),
  )
}

async function reconcileSeriesEntries(input: {
  userId: string
  series: DecodedSeries
  now: string
}) {
  const dates = generateMileageOccurrences(occurrenceInput(input.series))
  const existing = (await listEntriesForUser(input.userId)).filter(
    (entry) => entry.seriesId === input.series.id,
  )
  const plan = planSeriesReconcile({
    nextDates: dates,
    existingEntries: existing.map((entry) => ({
      id: entry.id,
      date: entry.date,
      seriesOverride: entry.seriesOverride,
    })),
  })

  if (plan.entriesToUpdate.length > 0) {
    const ids = plan.entriesToUpdate.map((entry) => entry.id)
    await drizzle
      .update(mileageEntry)
      .set({
        journeyDetails: input.series.journeyDetails,
        miles: input.series.milesPerJourney,
        updatedAt: input.now,
      })
      .where(
        and(
          eq(mileageEntry.userId, input.userId),
          eq(mileageEntry.seriesOverride, false),
          inArray(mileageEntry.id, ids),
        ),
      )
  }

  if (plan.entriesToDelete.length > 0) {
    await drizzle.delete(mileageEntry).where(
      and(
        eq(mileageEntry.userId, input.userId),
        eq(mileageEntry.seriesOverride, false),
        inArray(
          mileageEntry.id,
          plan.entriesToDelete.map((entry) => entry.id),
        ),
      ),
    )
  }

  await insertGeneratedEntries({
    userId: input.userId,
    seriesId: input.series.id,
    dates: plan.datesToInsert,
    journeyDetails: input.series.journeyDetails,
    miles: input.series.milesPerJourney,
    now: input.now,
  })
}

export async function listMileageSeries(userId: string): Promise<MileageSeriesDto[]> {
  try {
    const rows = await drizzle
      .select()
      .from(mileageSeries)
      .where(eq(mileageSeries.userId, userId))
      .orderBy(desc(mileageSeries.createdAt))

    return rows.map((row) => toSeriesDto(decodeSeries(row), []))
  } catch (error) {
    throw new Error(formatMileageSeriesDbError(error, 'Failed to load mileage series'))
  }
}

export async function getMileageSeries(
  userId: string,
  seriesId: string,
): Promise<MileageSeriesDto> {
  const series = await requireSeries(userId, seriesId)
  const entries = await listEntriesForUser(userId)
  return toSeriesDto(series, entries)
}

export async function createMileageSeries(
  userId: string,
  input: MileageSeriesWriteInput,
): Promise<MileageSeriesDto> {
  try {
    validateWriteInput(input)

    const now = new Date().toISOString()
    const seriesId = crypto.randomUUID()
    const [created] = await drizzle
      .insert(mileageSeries)
      .values({
        id: seriesId,
        userId,
        ...seriesValues(input, []),
        active: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (!created) {
      throw new Error('Failed to create mileage series')
    }

    const series = decodeSeries(created)
    const dates = generateMileageOccurrences(
      occurrenceInput({ ...series, deletedDates: [] }),
    )
    await insertGeneratedEntries({
      userId,
      seriesId,
      dates,
      journeyDetails: series.journeyDetails,
      miles: series.milesPerJourney,
      now,
    })

    return toSeriesDto(series, await listEntriesForUser(userId))
  } catch (error) {
    throw new Error(formatMileageSeriesDbError(error, 'Failed to create mileage series'))
  }
}

export async function updateMileageSeries(
  userId: string,
  seriesId: string,
  input: MileageSeriesWriteInput,
  scope: { type: 'entireSeries' } | { type: 'thisAndFuture'; fromDate: string },
): Promise<MileageSeriesDto> {
  const existing = await requireSeries(userId, seriesId)

  if (scope.type === 'thisAndFuture' && scope.fromDate > existing.startDate) {
    return splitAndUpdateSeries(userId, existing, input, scope.fromDate)
  }

  validateWriteInput(input, existing.deletedDates)
  const now = new Date().toISOString()
  const [updated] = await drizzle
    .update(mileageSeries)
    .set({
      ...seriesValues(input, existing.deletedDates),
      active: true,
      updatedAt: now,
    })
    .where(and(eq(mileageSeries.id, seriesId), eq(mileageSeries.userId, userId)))
    .returning()

  const series = decodeSeries(updated!)
  await reconcileSeriesEntries({ userId, series, now })
  return toSeriesDto(series, await listEntriesForUser(userId))
}

async function splitAndUpdateSeries(
  userId: string,
  existing: DecodedSeries,
  input: MileageSeriesWriteInput,
  fromDate: string,
): Promise<MileageSeriesDto> {
  const { oldEndDate, newStartDate } = splitSeriesBoundary(fromDate)
  if (oldEndDate < existing.startDate) {
    return updateMileageSeries(userId, existing.id, input, { type: 'entireSeries' })
  }

  const newInput: MileageSeriesWriteInput = {
    ...input,
    startDate: newStartDate,
    excludedDates: datesInRange(input.excludedDates, newStartDate, input.endDate),
  }
  const newDeletedDates = datesInRange(existing.deletedDates, newStartDate, input.endDate)
  validateWriteInput(newInput, newDeletedDates)

  const now = new Date().toISOString()
  const oldExcluded = datesInRange(existing.excludedDates, existing.startDate, oldEndDate)
  const oldDeleted = datesInRange(existing.deletedDates, existing.startDate, oldEndDate)

  await drizzle
    .update(mileageSeries)
    .set({
      endDate: oldEndDate,
      excludedDates: serializeJsonList(oldExcluded),
      deletedDates: serializeJsonList(oldDeleted),
      updatedAt: now,
    })
    .where(and(eq(mileageSeries.id, existing.id), eq(mileageSeries.userId, userId)))

  const [created] = await drizzle
    .insert(mileageSeries)
    .values({
      id: crypto.randomUUID(),
      userId,
      ...seriesValues(newInput, newDeletedDates),
      active: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  const newSeries = decodeSeries(created!)
  const futureEntries = entriesOnOrAfter(
    (await listEntriesForUser(userId)).filter((entry) => entry.seriesId === existing.id),
    newStartDate,
  )

  if (futureEntries.length > 0) {
    await drizzle
      .update(mileageEntry)
      .set({ seriesId: newSeries.id, updatedAt: now })
      .where(
        and(
          eq(mileageEntry.userId, userId),
          inArray(
            mileageEntry.id,
            futureEntries.map((entry) => entry.id),
          ),
        ),
      )
  }

  await reconcileSeriesEntries({ userId, series: newSeries, now })
  return toSeriesDto(newSeries, await listEntriesForUser(userId))
}

export async function deleteMileageSeries(
  userId: string,
  seriesId: string,
  scope: { type: 'entireSeries' } | { type: 'thisAndFuture'; fromDate: string },
): Promise<boolean> {
  const existing = await requireSeries(userId, seriesId)
  const now = new Date().toISOString()

  if (scope.type === 'entireSeries') {
    const [updated] = await drizzle
      .update(mileageSeries)
      .set({ active: false, updatedAt: now })
      .where(and(eq(mileageSeries.id, seriesId), eq(mileageSeries.userId, userId)))
      .returning({ id: mileageSeries.id })
    return Boolean(updated)
  }

  const { oldEndDate } = splitSeriesBoundary(scope.fromDate)
  if (oldEndDate < existing.startDate) {
    return deleteMileageSeries(userId, seriesId, { type: 'entireSeries' })
  }

  const futureEntries = entriesOnOrAfter(
    (await listEntriesForUser(userId)).filter(
      (entry) => entry.seriesId === seriesId && !entry.seriesOverride,
    ),
    scope.fromDate,
  )
  const deletedDates = [
    ...existing.deletedDates,
    ...futureEntries.map((entry) => entry.date),
  ]

  if (futureEntries.length > 0) {
    await drizzle.delete(mileageEntry).where(
      and(
        eq(mileageEntry.userId, userId),
        inArray(
          mileageEntry.id,
          futureEntries.map((entry) => entry.id),
        ),
      ),
    )
  }

  const [updated] = await drizzle
    .update(mileageSeries)
    .set({
      endDate: oldEndDate,
      deletedDates: serializeJsonList(deletedDates),
      excludedDates: serializeJsonList(
        datesInRange(existing.excludedDates, existing.startDate, oldEndDate),
      ),
      updatedAt: now,
    })
    .where(and(eq(mileageSeries.id, seriesId), eq(mileageSeries.userId, userId)))
    .returning({ id: mileageSeries.id })

  return Boolean(updated)
}

export async function addDeletedOccurrence(
  userId: string,
  seriesId: string,
  isoDate: string,
) {
  const series = await requireSeries(userId, seriesId)
  if (series.deletedDates.includes(isoDate)) return

  await drizzle
    .update(mileageSeries)
    .set({
      deletedDates: serializeJsonList([...series.deletedDates, isoDate].sort()),
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(mileageSeries.id, seriesId), eq(mileageSeries.userId, userId)))
}
