import { eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { hmrcOAuthState } from '~/database/schema'
import { server } from '~/env'
import { jsonError, requireAuth } from '~/server/apiHelpers'
import { completeHmrcAuthorization } from '~/features/hmrc/server/connectionService'
import { requireHmrcConfigured } from '~/features/hmrc/server/config'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    requireHmrcConfigured()
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      return Response.redirect(
        `${getAppReturnUrl()}?hmrc=error&message=${encodeURIComponent(error)}`,
      )
    }

    if (!code || !state) {
      return Response.redirect(`${getAppReturnUrl()}?hmrc=error&message=missing_code`)
    }

    const [oauthState] = await drizzle
      .select()
      .from(hmrcOAuthState)
      .where(eq(hmrcOAuthState.id, state))
      .limit(1)

    if (!oauthState) {
      return Response.redirect(`${getAppReturnUrl()}?hmrc=error&message=invalid_state`)
    }

    const result = await completeHmrcAuthorization({
      userId: oauthState.userId,
      state,
      code,
    })

    const returnTo = result.returnTo || getAppReturnUrl()
    const separator = returnTo.includes('?') ? '&' : '?'
    const destination = returnTo.startsWith('http')
      ? `${returnTo}${separator}hmrc=connected`
      : `${getAppReturnUrl()}${separator}hmrc=connected`
    return Response.redirect(destination)
  } catch (error) {
    console.error('[hmrc] callback error', error)
    const message = error instanceof Error ? error.message : 'callback_failed'
    return Response.redirect(
      `${getAppReturnUrl()}?hmrc=error&message=${encodeURIComponent(message)}`,
    )
  }
}

function getAppReturnUrl() {
  return `${server.BETTER_AUTH_URL}/home/settings`
}

export const POST: Endpoint = async (request) => {
  try {
    requireHmrcConfigured()
    const authData = await requireAuth(request)
    const body = (await request.json().catch(() => ({}))) as {
      code?: string
      state?: string
    }

    if (!body.code || !body.state) {
      return jsonError('code and state are required')
    }

    const result = await completeHmrcAuthorization({
      userId: authData.id,
      state: body.state,
      code: body.code,
    })

    return Response.json({ connected: true, nino: result.nino })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[hmrc] exchange error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to connect HMRC',
      500,
    )
  }
}
