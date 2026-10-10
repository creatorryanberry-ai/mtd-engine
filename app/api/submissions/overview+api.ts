import { jsonError, requireAuth } from '~/server/apiHelpers'
import { parseTaxYearStart } from '~/features/mtd/utils/quarterPeriods'
import { getSubmissionsOverview } from '~/features/submission/server/submissionsOverviewService'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const taxYearStart = parseTaxYearStart(
      url.searchParams.get('taxYearStart') ?? undefined,
    )
    const overview = await getSubmissionsOverview(authData.id, taxYearStart ?? undefined)

    return Response.json(overview)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[submissions] overview error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load submissions overview',
      500,
    )
  }
}
