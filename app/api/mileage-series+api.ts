import { jsonError, requireAuth } from '~/server/apiHelpers'
import {
  createMileageSeries,
  deleteMileageSeries,
  getMileageSeries,
  listMileageSeries,
  updateMileageSeries,
} from '~/features/mileage/server/mileageSeriesService'
import {
  MILEAGE_RECURRENCE_TYPES,
  normalizeWeekdays,
} from '~/features/mileage/utils/mileageOccurrences'

import type { MileageSeriesWriteInput } from '~/features/mileage/mileageSeriesTypes'
import type { Endpoint } from 'one'

function parseMiles(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function parseWeekdays(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return normalizeWeekdays(
    value.flatMap((item) => {
      if (typeof item === 'number') return [item]
      if (typeof item === 'string' && item.trim()) {
        const parsed = Number.parseInt(item, 10)
        return Number.isFinite(parsed) ? [parsed] : []
      }
      return []
    }),
  )
}

function parseWriteInput(body: Record<string, unknown>): MileageSeriesWriteInput | null {
  const milesPerJourney = parseMiles(body.milesPerJourney)
  const recurrenceType = body.recurrenceType
  if (
    milesPerJourney == null ||
    typeof recurrenceType !== 'string' ||
    !MILEAGE_RECURRENCE_TYPES.includes(
      recurrenceType as (typeof MILEAGE_RECURRENCE_TYPES)[number],
    )
  ) {
    return null
  }

  return {
    fromLocation: typeof body.fromLocation === 'string' ? body.fromLocation : null,
    journeyDetails: typeof body.journeyDetails === 'string' ? body.journeyDetails : '',
    milesPerJourney,
    includesReturnJourney: Boolean(body.includesReturnJourney),
    recurrenceType: recurrenceType as MileageSeriesWriteInput['recurrenceType'],
    selectedWeekdays: parseWeekdays(body.selectedWeekdays),
    startDate: typeof body.startDate === 'string' ? body.startDate : '',
    endDate: typeof body.endDate === 'string' ? body.endDate : '',
    excludedDates: parseStringArray(body.excludedDates),
  }
}

function parseScope(body: Record<string, unknown>, search: URLSearchParams) {
  const scope =
    (typeof body.scope === 'string' ? body.scope : search.get('scope')) ?? 'entireSeries'
  const fromDate =
    (typeof body.fromDate === 'string' ? body.fromDate : search.get('fromDate')) ?? ''

  if (scope === 'thisAndFuture') {
    if (!fromDate) return null
    return { type: 'thisAndFuture' as const, fromDate }
  }

  return { type: 'entireSeries' as const }
}

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const seriesId = url.searchParams.get('id')

    if (seriesId) {
      const series = await getMileageSeries(authData.id, seriesId)
      return Response.json({ series })
    }

    const series = await listMileageSeries(authData.id)
    return Response.json({ series })
  } catch (error) {
    if (error instanceof Response) return error
    const message =
      error instanceof Error ? error.message : 'Failed to load mileage series'
    console.error('[mileage-series] list error', error)
    return jsonError(message, message.includes('not found') ? 404 : 500)
  }
}

export const POST: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as Record<string, unknown>
    const input = parseWriteInput(body)
    if (!input) {
      return jsonError(
        'journeyDetails, milesPerJourney, recurrence, and dates are required',
      )
    }

    const series = await createMileageSeries(authData.id, input)
    return Response.json({ series })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[mileage-series] create error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to create mileage series',
      400,
    )
  }
}

export const PATCH: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as Record<string, unknown>
    const seriesId = typeof body.id === 'string' ? body.id : ''
    if (!seriesId) {
      return jsonError('Series id is required')
    }

    const input = parseWriteInput(body)
    if (!input) {
      return jsonError(
        'journeyDetails, milesPerJourney, recurrence, and dates are required',
      )
    }

    const scope = parseScope(body, new URL(request.url).searchParams)
    if (!scope) {
      return jsonError('fromDate is required when editing this and future journeys')
    }

    const series = await updateMileageSeries(authData.id, seriesId, input, scope)
    return Response.json({ series })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[mileage-series] update error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to update mileage series',
      400,
    )
  }
}

export const DELETE: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const seriesId = url.searchParams.get('id')
    if (!seriesId) {
      return jsonError('Series id is required')
    }

    const scope = parseScope({}, url.searchParams)
    if (!scope) {
      return jsonError('fromDate is required when deleting this and future journeys')
    }

    const deleted = await deleteMileageSeries(authData.id, seriesId, scope)
    if (!deleted) {
      return jsonError('Mileage series not found', 404)
    }

    return Response.json({ success: true })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[mileage-series] delete error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to delete mileage series',
      500,
    )
  }
}
