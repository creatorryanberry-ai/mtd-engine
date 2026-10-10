import { jsonError, requireAuth } from '~/server/apiHelpers'
import { parseFraudHeadersFromRequest } from '~/features/hmrc/server/fraudHeaders'
import { getNextOpenHmrcObligation } from '~/features/hmrc/server/obligations'
import { requireHmrcConfigured } from '~/features/hmrc/server/config'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    requireHmrcConfigured()
    const authData = await requireAuth(request)
    const obligation = await getNextOpenHmrcObligation({
      userId: authData.id,
      request,
      fraudHeaders: parseFraudHeadersFromRequest(request),
    })
    return Response.json({ obligation })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[hmrc] obligations error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load HMRC obligations',
      500,
    )
  }
}
