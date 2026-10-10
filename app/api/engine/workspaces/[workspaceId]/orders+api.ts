import { defineRoute } from '~/api/defineRoute'
import {
  engineOrderSchema,
  pageSchema,
  paginatedQuerySchema,
} from '~/features/engine/contract'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { listOrders } from '~/features/engine/sense/server/ordersList'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/orders',
  summary: 'Orders, newest first',
  tags: ['engine'],
  input: paginatedQuerySchema,
  output: pageSchema(engineOrderSchema),
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => listOrders(access.workspace.id, input),
    ),
})
