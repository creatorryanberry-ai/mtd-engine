import { defineRoute } from '~/api/defineRoute'
import { listConnections } from '~/features/engine/channels/server/connectionService'
import { engineConnectionListSchema } from '~/features/engine/contract'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/connections',
  summary: 'List workspace connections',
  description: 'Connections for a workspace. Credentials are never included.',
  tags: ['engine'],
  output: engineConnectionListSchema,
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(request, requireParam(params, 'workspaceId'), 'viewer', () =>
      listConnections(requireParam(params, 'workspaceId')),
    ),
})
