import { and, desc, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { mileageEntry } from '~/database/schema'
import { addDeletedOccurrence } from '~/features/mileage/server/mileageSeriesService'
import { enrichMileageEntriesWithClaims } from '~/features/mileage/utils/mileageClaim'

import type { MileageEntryWithClaim } from '~/features/mileage/utils/mileageClaim'

export type MileageEntryRecord = typeof mileageEntry.$inferSelect

export type MileageEntryDto = MileageEntryRecord & {
  cumulativeMilesBefore: number
  claim: MileageEntryWithClaim['claim']
}

function toDtos(entries: MileageEntryRecord[]): MileageEntryDto[] {
  return enrichMileageEntriesWithClaims(entries).sort((left, right) => {
    if (left.date !== right.date) return right.date.localeCompare(left.date)
    return right.createdAt.localeCompare(left.createdAt)
  })
}

function findDto(entries: MileageEntryDto[], entryId: string) {
  const entry = entries.find((item) => item.id === entryId)
  if (!entry) {
    throw new Error('Mileage entry not found')
  }
  return entry
}

function validateMileageInput(input: {
  date?: string
  journeyDetails?: string
  miles?: number
}) {
  if (!input.date?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date.trim())) {
    throw new Error('A valid date is required')
  }

  if (!input.journeyDetails?.trim()) {
    throw new Error('Journey details are required')
  }

  if (input.miles == null || !Number.isFinite(input.miles) || input.miles <= 0) {
    throw new Error('Mileage must be greater than zero')
  }
}

export async function listMileageEntries(userId: string) {
  const entries = await drizzle
    .select()
    .from(mileageEntry)
    .where(eq(mileageEntry.userId, userId))
    .orderBy(desc(mileageEntry.date), desc(mileageEntry.createdAt))

  return toDtos(entries)
}

export async function listMileageEntriesPage(
  userId: string,
  offset: number,
  limit: number,
) {
  const [pageRows, mileLog] = await Promise.all([
    drizzle
      .select()
      .from(mileageEntry)
      .where(eq(mileageEntry.userId, userId))
      .orderBy(desc(mileageEntry.date), desc(mileageEntry.createdAt))
      .limit(limit)
      .offset(offset),
    drizzle
      .select({
        id: mileageEntry.id,
        date: mileageEntry.date,
        miles: mileageEntry.miles,
        createdAt: mileageEntry.createdAt,
        updatedAt: mileageEntry.updatedAt,
        journeyDetails: mileageEntry.journeyDetails,
      })
      .from(mileageEntry)
      .where(eq(mileageEntry.userId, userId)),
  ])

  const enriched = enrichMileageEntriesWithClaims(mileLog)
  const claimById = new Map(enriched.map((entry) => [entry.id, entry.claim]))
  const entries = pageRows.map((row) => {
    const claim = claimById.get(row.id)
    if (!claim) {
      throw new Error('Mileage entry not found')
    }
    return { ...row, cumulativeMilesBefore: 0, claim }
  })

  return {
    entries,
    totalCount: mileLog.length,
    totalClaimPounds: enriched.reduce((sum, entry) => sum + entry.claim.claimPounds, 0),
    hasMore: offset + pageRows.length < mileLog.length,
  }
}

export async function createMileageEntry(
  userId: string,
  input: {
    date: string
    journeyDetails: string
    miles: number
    seriesId?: string | null
    seriesOverride?: boolean
  },
) {
  validateMileageInput(input)

  const now = new Date().toISOString()
  const [created] = await drizzle
    .insert(mileageEntry)
    .values({
      id: crypto.randomUUID(),
      userId,
      date: input.date.trim(),
      journeyDetails: input.journeyDetails.trim(),
      miles: input.miles,
      seriesId: input.seriesId ?? null,
      seriesOverride: input.seriesOverride ?? false,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  const allEntries = await drizzle
    .select()
    .from(mileageEntry)
    .where(eq(mileageEntry.userId, userId))

  return findDto(toDtos(allEntries), created!.id)
}

export async function updateMileageEntry(
  userId: string,
  entryId: string,
  input: { date: string; journeyDetails: string; miles: number },
) {
  validateMileageInput(input)

  const [existing] = await drizzle
    .select()
    .from(mileageEntry)
    .where(and(eq(mileageEntry.id, entryId), eq(mileageEntry.userId, userId)))
    .limit(1)

  if (!existing) {
    throw new Error('Mileage entry not found')
  }

  if (existing.seriesId && existing.date !== input.date.trim()) {
    await addDeletedOccurrence(userId, existing.seriesId, existing.date)
  }

  const now = new Date().toISOString()
  const [updated] = await drizzle
    .update(mileageEntry)
    .set({
      date: input.date.trim(),
      journeyDetails: input.journeyDetails.trim(),
      miles: input.miles,
      seriesOverride: existing.seriesId ? true : existing.seriesOverride,
      updatedAt: now,
    })
    .where(and(eq(mileageEntry.id, entryId), eq(mileageEntry.userId, userId)))
    .returning()

  if (!updated) {
    throw new Error('Mileage entry not found')
  }

  const allEntries = await drizzle
    .select()
    .from(mileageEntry)
    .where(eq(mileageEntry.userId, userId))

  return findDto(toDtos(allEntries), updated.id)
}

export async function deleteMileageEntry(userId: string, entryId: string) {
  const [existing] = await drizzle
    .select()
    .from(mileageEntry)
    .where(and(eq(mileageEntry.id, entryId), eq(mileageEntry.userId, userId)))
    .limit(1)

  if (!existing) return false

  if (existing.seriesId) {
    await addDeletedOccurrence(userId, existing.seriesId, existing.date)
  }

  const [deleted] = await drizzle
    .delete(mileageEntry)
    .where(and(eq(mileageEntry.id, entryId), eq(mileageEntry.userId, userId)))
    .returning({ id: mileageEntry.id })

  return Boolean(deleted)
}
