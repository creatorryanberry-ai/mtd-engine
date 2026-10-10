import { defineRoute } from '~/api/defineRoute'
import { disconnectConnection } from '~/features/engine/channels/server/connectionService'
import { okSchema } from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { jsonError } from '~/server/apiHelpers'

import type { Endpoint } from 'one'

export const DELETE: Endpoint = defineRoute({
  method: 'DELETE',
  path: '/api/engine/workspaces/{workspaceId}/connections/{connectionId}',
  summary: 'Disconnect a connection',
  description: 'Marks the connection disconnected and wipes its stored credentials.',
  tags: ['engine'],
  output: okSchema,
  errorResponses: [{ status: 404, description: 'Connection not found' }],
  handler: (_input, { request, params }) => {
    const { workspaceId, connectionId } = params
    if (!workspaceId || !connectionId) throw jsonError('Missing route params', 400)
    return withWorkspaceAccess(request, workspaceId, 'admin', ({ auth }) =>
      disconnectConnection({
        workspaceId,
        connectionId,
        userId: auth.id,
        ipAddress: requestIp(request),
      }),
    )
  },
})
