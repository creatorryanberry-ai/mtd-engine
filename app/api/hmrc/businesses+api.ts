import { jsonError, requireAuth } from '~/server/apiHelpers'
import { parseFraudHeadersFromRequest } from '~/features/hmrc/server/fraudHeaders'
import { listHmrcBusinesses } from '~/features/hmrc/server/businessDetails'
import { setHmrcBusiness } from '~/features/hmrc/server/connectionService'
import { requireHmrcConfigured } from '~/features/hmrc/server/config'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    requireHmrcConfigured()
    const authData = await requireAuth(request)
    const businesses = await listHmrcBusinesses({
      userId: authData.id,
      request,
      fraudHeaders: parseFraudHeadersFromRequest(request),
    })
    return Response.json({ businesses })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[hmrc] businesses error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load HMRC businesses',
      500,
    )
  }
}

export const POST: Endpoint = async (request) => {
  try {
    requireHmrcConfigured()
    const authData = await requireAuth(request)
    const body = (await request.json().catch(() => ({}))) as {
      businessId?: string
      businessName?: string | null
    }

    if (!body.businessId) {
      return jsonError('businessId is required')
    }

    await setHmrcBusiness(authData.id, body.businessId, body.businessName ?? null)
    return Response.json({ businessId: body.businessId })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[hmrc] select business error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to select HMRC business',
      500,
    )
  }
}
