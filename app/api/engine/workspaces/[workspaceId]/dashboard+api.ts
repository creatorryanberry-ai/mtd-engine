import { defineRoute } from '~/api/defineRoute'
import { dashboardSummarySchema } from '~/features/engine/contract'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { getDashboardSummary } from '~/features/engine/sense/server/dashboard'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/dashboard',
  summary: 'Command centre summary for the workspace',
  tags: ['engine'],
  output: dashboardSummarySchema,
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => getDashboardSummary(access.workspace),
    ),
})
