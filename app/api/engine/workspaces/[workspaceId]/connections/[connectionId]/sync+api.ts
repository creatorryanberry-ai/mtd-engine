import { defineRoute } from '~/api/defineRoute'
import { enqueueSync } from '~/features/engine/channels/server/connectionService'
import { syncInputSchema, syncResponseSchema } from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { jsonError } from '~/server/apiHelpers'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/connections/{connectionId}/sync',
  summary: 'Enqueue a connection sync',
  description:
    'Queues a background sync for the connection. Scope defaults to orders for revenue connectors and all for channels.',
  tags: ['engine'],
  input: syncInputSchema,
  output: syncResponseSchema,
  errorResponses: [
    { status: 404, description: 'Connection not found' },
    { status: 409, description: 'Connection is not connected' },
  ],
  handler: (input, { request, params }) => {
    const { workspaceId, connectionId } = params
    if (!workspaceId || !connectionId) throw jsonError('Missing route params', 400)
    return withWorkspaceAccess(request, workspaceId, 'marketer', async ({ auth }) => {
      const result = await enqueueSync({
        workspaceId,
        connectionId,
        scope: input.scope ?? null,
        userId: auth.id,
        ipAddress: requestIp(request),
      })
      return { queued: result.queued, jobId: result.jobId }
    })
  },
})
