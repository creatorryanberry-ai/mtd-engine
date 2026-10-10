import { jsonError, requireAuth } from '~/server/apiHelpers'
import { getHmrcConnectionStatus } from '~/features/hmrc/server/connectionService'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const status = await getHmrcConnectionStatus(authData.id)
    return Response.json(status)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[hmrc] status error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load HMRC status',
      500,
    )
  }
}
