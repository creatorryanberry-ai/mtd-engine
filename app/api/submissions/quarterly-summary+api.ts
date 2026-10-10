import { jsonError, requireAuth } from '~/server/apiHelpers'
import { getQuarterlySummary } from '~/features/submission/server/submissionService'
import { parseQuarterId, parseTaxYearStart } from '~/features/mtd/utils/quarterPeriods'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const quarterId = parseQuarterId(url.searchParams.get('quarter') ?? undefined)
    const taxYearStart = parseTaxYearStart(
      url.searchParams.get('taxYearStart') ?? undefined,
    )
    const summary = await getQuarterlySummary(
      authData.id,
      quarterId ?? undefined,
      taxYearStart ?? undefined,
    )

    return Response.json(summary)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[submissions] quarterly-summary error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load quarterly summary',
      500,
    )
  }
}
