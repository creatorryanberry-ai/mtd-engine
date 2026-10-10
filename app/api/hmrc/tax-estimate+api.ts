import { jsonError, requireAuth } from '~/server/apiHelpers'
import { parseFraudHeadersFromRequest } from '~/features/hmrc/server/fraudHeaders'
import { getHmrcInYearTaxEstimate } from '~/features/hmrc/server/calculations'
import { requireHmrcConfigured } from '~/features/hmrc/server/config'
import { getCurrentQuarter } from '~/features/mtd/utils/quarterPeriods'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    requireHmrcConfigured()
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const taxYearStart =
      url.searchParams.get('taxYearStart') ?? getCurrentQuarter().taxYearStart

    const estimate = await getHmrcInYearTaxEstimate({
      userId: authData.id,
      taxYearStart,
      request,
      fraudHeaders: parseFraudHeadersFromRequest(request),
    })

    return Response.json(estimate)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[hmrc] tax-estimate error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load HMRC tax estimate',
      500,
    )
  }
}
