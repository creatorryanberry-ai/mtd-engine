import { defineRoute } from '~/api/defineRoute'
import {
  experimentAssignmentQuerySchema,
  experimentAssignmentSchema,
} from '~/features/engine/contract'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { getAssignment } from '~/features/engine/measure/server/experimentService'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/experiments/{experimentId}/assignment',
  summary: "A contact's group in an experiment",
  tags: ['engine'],
  input: experimentAssignmentQuerySchema,
  output: experimentAssignmentSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) =>
        getAssignment(
          access.workspace.id,
          requireParam(params, 'experimentId'),
          input.contactId,
        ),
    ),
})
