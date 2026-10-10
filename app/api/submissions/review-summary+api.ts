import { jsonError, requireAuth } from '~/server/apiHelpers'
import { getReviewFinancialSummary } from '~/features/submission/server/reviewFinancialSummary'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const quarterId = url.searchParams.get('quarter')
    const taxYearStart = url.searchParams.get('taxYearStart')
    const summary = await getReviewFinancialSummary(authData.id, {
      quarterId,
      taxYearStart,
    })
    return Response.json(summary)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[submissions] review-summary error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load review summary',
      500,
    )
  }
}
