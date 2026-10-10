import { jsonError, requireAuth } from '~/server/apiHelpers'
import {
  createMileageEntry,
  deleteMileageEntry,
  listMileageEntries,
  listMileageEntriesPage,
  updateMileageEntry,
} from '~/features/mileage/server/mileageService'
import { parseMileageListPage } from '~/features/mileage/utils/mileageListPage'

import type { Endpoint } from 'one'

function toMileageDto(entry: Awaited<ReturnType<typeof listMileageEntries>>[number]) {
  return {
    id: entry.id,
    date: entry.date,
    journeyDetails: entry.journeyDetails,
    miles: entry.miles,
    seriesId: entry.seriesId,
    seriesOverride: entry.seriesOverride,
    rateLabel: entry.claim.rateLabel,
    claimPounds: entry.claim.claimPounds,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

function parseMiles(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseBody(body: { date?: string; journeyDetails?: string; miles?: unknown }) {
  const miles = parseMiles(body.miles)
  if (miles == null) {
    return null
  }

  return {
    date: body.date ?? '',
    journeyDetails: body.journeyDetails ?? '',
    miles,
  }
}

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const page = parseMileageListPage(new URL(request.url).searchParams)
    if (!page) {
      const entries = await listMileageEntries(authData.id)
      return Response.json({ entries: entries.map(toMileageDto) })
    }

    const paged = await listMileageEntriesPage(authData.id, page.offset, page.limit)
    return Response.json({
      entries: paged.entries.map(toMileageDto),
      totalCount: paged.totalCount,
      totalClaimPounds: paged.totalClaimPounds,
      hasMore: paged.hasMore,
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[mileage] list error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load mileage entries',
      500,
    )
  }
}

export const POST: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as {
      date?: string
      journeyDetails?: string
      miles?: unknown
    }
    const input = parseBody(body)

    if (!input) {
      return jsonError('date, journeyDetails, and miles are required')
    }

    const created = await createMileageEntry(authData.id, input)
    return Response.json({ entry: toMileageDto(created) })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[mileage] create error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to create mileage entry',
      500,
    )
  }
}

export const PATCH: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as {
      id?: string
      date?: string
      journeyDetails?: string
      miles?: unknown
    }

    if (!body.id) {
      return jsonError('Entry id is required')
    }

    const input = parseBody(body)
    if (!input) {
      return jsonError('date, journeyDetails, and miles are required')
    }

    const updated = await updateMileageEntry(authData.id, body.id, input)
    return Response.json({ entry: toMileageDto(updated) })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[mileage] update error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to update mileage entry',
      400,
    )
  }
}

export const DELETE: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const entryId = url.searchParams.get('id')

    if (!entryId) {
      return jsonError('Entry id is required')
    }

    const deleted = await deleteMileageEntry(authData.id, entryId)
    if (!deleted) {
      return jsonError('Mileage entry not found', 404)
    }

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[mileage] delete error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to delete mileage entry',
      500,
    )
  }
}
