import { jsonError, requireAuth } from '~/server/apiHelpers'
import {
  getCategorisationStats,
  getFilterCounts,
} from '~/features/categorisation/server/categorisationService'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const includeFilters = url.searchParams.get('filters') === 'true'
    const unreviewedOnly = url.searchParams.get('unreviewedOnly') === 'true'
    const bankAccountId = url.searchParams.get('bankAccountId') || undefined

    const stats = await getCategorisationStats(authData.id, bankAccountId)

    if (!includeFilters) {
      return Response.json(stats)
    }

    const filterCounts = await getFilterCounts(authData.id, unreviewedOnly, bankAccountId)
    return Response.json({ ...stats, filterCounts })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[categorisation] stats error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load categorisation stats',
      500,
    )
  }
}
