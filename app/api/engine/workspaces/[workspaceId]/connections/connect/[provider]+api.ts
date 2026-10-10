import { defineRoute } from '~/api/defineRoute'
import { connectorAuthKind, getConnector } from '~/features/engine/channels/registry'
import {
  createApiKeyConnection,
  startOAuthConnection,
} from '~/features/engine/channels/server/connectionService'
import { connectInputSchema, connectResponseSchema } from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { jsonError } from '~/server/apiHelpers'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/connections/connect/{provider}',
  summary: 'Start a connection',
  description:
    'OAuth providers return an authorizeUrl to redirect the user to; api-key providers take the key in the body, verify it and return the connection id.',
  tags: ['engine'],
  input: connectInputSchema,
  output: connectResponseSchema,
  errorResponses: [
    { status: 400, description: 'Missing api key or provider not configured' },
    { status: 404, description: 'Unknown connector' },
  ],
  handler: (input, { request, params }) => {
    const { workspaceId, provider } = params
    if (!workspaceId || !provider) throw jsonError('Missing route params', 400)
    return withWorkspaceAccess(request, workspaceId, 'admin', async ({ auth }) => {
      const connector = getConnector(provider)
      if (!connector) throw jsonError(`Unknown connector ${provider}`, 404)
      const ipAddress = requestIp(request)

      if (connectorAuthKind(connector) === 'api_key') {
        if (!input.apiKey?.trim()) throw jsonError('apiKey is required', 400)
        const { connection } = await createApiKeyConnection({
          workspaceId,
          userId: auth.id,
          provider,
          apiKey: input.apiKey,
          webhookSecret: input.webhookSecret ?? null,
          ipAddress,
        })
        return { connectionId: connection.id, authorizeUrl: null }
      }

      const result = await startOAuthConnection({
        workspaceId,
        userId: auth.id,
        provider,
        returnTo: input.returnTo ?? null,
        ipAddress,
      })
      return { connectionId: null, authorizeUrl: result.authorizeUrl }
    })
  },
})
