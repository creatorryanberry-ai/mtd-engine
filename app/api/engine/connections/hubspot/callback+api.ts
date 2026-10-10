import { eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineOAuthState } from '~/database/engineSchema'
import { server } from '~/env'
import { completeOAuthConnection } from '~/features/engine/channels/server/connectionService'

import type { Endpoint } from 'one'

/** documented in src/api/openapi/engine.ts; raw handler because it redirects */
export const GET: Endpoint = async (request) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const providerError = url.searchParams.get('error')

  const workspaceId = state ? await workspaceForState(state) : null
  if (!workspaceId) {
    return Response.redirect(integrationsUrl(null, 'error', 'invalid_state'))
  }
  if (providerError) {
    return Response.redirect(integrationsUrl(workspaceId, 'error', providerError))
  }
  if (!code || !state) {
    return Response.redirect(integrationsUrl(workspaceId, 'error', 'missing_code'))
  }

  try {
    const result = await completeOAuthConnection(state, code)
    const returnTo = result.returnTo
    if (returnTo && returnTo.startsWith('http')) {
      const separator = returnTo.includes('?') ? '&' : '?'
      return Response.redirect(`${returnTo}${separator}hubspot=connected`)
    }
    return Response.redirect(integrationsUrl(result.workspaceId, 'connected'))
  } catch (error) {
    console.error('[engine:hubspot] callback error', error)
    const message = error instanceof Error ? error.message : 'callback_failed'
    return Response.redirect(integrationsUrl(workspaceId, 'error', message))
  }
}

async function workspaceForState(stateId: string) {
  const [row] = await drizzle
    .select({ workspaceId: engineOAuthState.workspaceId })
    .from(engineOAuthState)
    .where(eq(engineOAuthState.id, stateId))
    .limit(1)
  return row?.workspaceId ?? null
}

function integrationsUrl(
  workspaceId: string | null,
  status: 'connected' | 'error',
  message?: string,
) {
  const base = server.ONE_SERVER_URL || server.API_SERVER_URL
  const path = workspaceId ? `/engine/${workspaceId}/integrations` : '/engine'
  const params = new URLSearchParams({ hubspot: status })
  if (message) params.set('message', message)
  return `${base}${path}?${params.toString()}`
}
