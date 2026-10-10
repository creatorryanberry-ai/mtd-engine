import { jsonError, requireAuth } from '~/server/apiHelpers'
import { createHmrcAuthorizationRequest } from '~/features/hmrc/server/connectionService'
import { requireHmrcConfigured } from '~/features/hmrc/server/config'
import { server } from '~/env'

import type { Endpoint } from 'one'

export const POST: Endpoint = async (request) => {
  try {
    requireHmrcConfigured()
    const authData = await requireAuth(request)
    const body = (await request.json().catch(() => ({}))) as {
      nino?: string
      platform?: 'web' | 'native'
      returnTo?: string
    }

    if (!body.nino?.trim()) {
      return jsonError('nino is required')
    }

    const platform = body.platform === 'native' ? 'native' : 'web'
    const returnTo =
      body.returnTo && body.returnTo.startsWith('http')
        ? body.returnTo
        : `${server.BETTER_AUTH_URL}${body.returnTo?.startsWith('/') ? body.returnTo : '/home/settings'}`

    const result = await createHmrcAuthorizationRequest({
      userId: authData.id,
      nino: body.nino,
      platform,
      returnTo,
    })

    return Response.json(result)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[hmrc] authorize error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to start HMRC authorisation',
      500,
    )
  }
}
