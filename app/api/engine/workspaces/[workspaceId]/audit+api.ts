import { defineRoute } from '~/api/defineRoute'
import {
  engineAuditLogSchema,
  pageSchema,
  paginatedQuerySchema,
} from '~/features/engine/contract'
import { listAuditLog } from '~/features/engine/core/server/auditList'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/audit',
  summary: 'Audit log, newest first',
  tags: ['engine'],
  input: paginatedQuerySchema,
  output: pageSchema(engineAuditLogSchema),
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => listAuditLog(access.workspace.id, input),
    ),
})
