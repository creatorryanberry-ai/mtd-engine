import { jsonError, requireAuth } from '~/server/apiHelpers'
import { parseFraudHeadersFromRequest } from '~/features/hmrc/server/fraudHeaders'
import {
  submitQuarterlyUpdate,
  unsubmitQuarterlyUpdate,
} from '~/features/submission/server/submissionService'
import { isDemoAuthAllowed } from '~/features/auth/server/isDemoAuthAllowed'
import { ensureAdmin } from '~/server/getIsAdmin'

import type { Endpoint } from 'one'

export const DELETE: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)

    if (!isDemoAuthAllowed()) {
      ensureAdmin(authData)
    }

    const url = new URL(request.url)
    const quarterId = url.searchParams.get('quarter') ?? undefined
    const taxYearStart = url.searchParams.get('taxYearStart') ?? undefined
    const result = await unsubmitQuarterlyUpdate(authData.id, quarterId, taxYearStart)

    return Response.json(result)
  } catch (error) {
    if (error instanceof Response) return error

    if (error instanceof Error) {
      if (error.message === 'not admin') {
        return jsonError('Admin access required', 403)
      }
      if (error.message === 'No submission found for this quarter') {
        return jsonError(error.message, 404)
      }
    }

    console.error('[submissions] quarterly unsubmit error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to unsubmit quarterly update',
      500,
    )
  }
}

export const POST: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json().catch(() => ({}))) as {
      quarterId?: string
      taxYearStart?: string
    }
    const result = await submitQuarterlyUpdate(authData.id, body.quarterId, {
      request,
      fraudHeaders: parseFraudHeadersFromRequest(request),
      taxYearStart: body.taxYearStart,
    })

    return Response.json(result)
  } catch (error) {
    if (error instanceof Response) return error

    if (error instanceof Error) {
      if (error.message === 'Submission is not ready') {
        return jsonError(error.message, 400)
      }
      if (error.message === 'This quarter has already been submitted') {
        return jsonError(error.message, 409)
      }
    }

    console.error('[submissions] quarterly submit error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to submit quarterly update',
      500,
    )
  }
}
