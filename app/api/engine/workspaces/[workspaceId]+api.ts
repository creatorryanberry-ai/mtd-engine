import { defineRoute } from '~/api/defineRoute'
import {
  engineWorkspaceSchema,
  updateWorkspaceInputSchema,
} from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { updateWorkspace } from '~/features/engine/core/server/workspaceService'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}',
  summary: 'Get an engine workspace',
  tags: ['engine'],
  output: engineWorkspaceSchema,
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      async (access) => {
        return access.workspace
      },
    ),
})

export const PATCH: Endpoint = defineRoute({
  method: 'PATCH',
  path: '/api/engine/workspaces/{workspaceId}',
  summary: 'Update workspace settings, budgets and the kill switch',
  tags: ['engine'],
  input: updateWorkspaceInputSchema,
  output: engineWorkspaceSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(request, requireParam(params, 'workspaceId'), 'admin', (access) =>
      updateWorkspace(access.workspace.id, access.auth.id, input, requestIp(request)),
    ),
})
