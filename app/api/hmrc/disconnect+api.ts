import { jsonError, requireAuth } from '~/server/apiHelpers'
import { disconnectHmrc } from '~/features/hmrc/server/connectionService'

import type { Endpoint } from 'one'

export const DELETE: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    await disconnectHmrc(authData.id)
    return Response.json({ disconnected: true })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[hmrc] disconnect error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to disconnect HMRC',
      500,
    )
  }
}
