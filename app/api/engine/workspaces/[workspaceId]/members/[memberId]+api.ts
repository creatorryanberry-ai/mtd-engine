import { defineRoute } from '~/api/defineRoute'
import {
  engineMembershipSchema,
  okSchema,
  updateMemberInputSchema,
} from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { requireParam } from '~/features/engine/core/server/httpError'
import {
  removeMember,
  updateMemberRole,
} from '~/features/engine/core/server/membershipService'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'

import type { Endpoint } from 'one'

export const PATCH: Endpoint = defineRoute({
  method: 'PATCH',
  path: '/api/engine/workspaces/{workspaceId}/members/{memberId}',
  summary: 'Change a member role',
  tags: ['engine'],
  input: updateMemberInputSchema,
  output: engineMembershipSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(request, requireParam(params, 'workspaceId'), 'admin', (access) =>
      updateMemberRole(
        access.workspace.id,
        access.auth.id,
        requireParam(params, 'memberId'),
        input.role,
        requestIp(request),
      ),
    ),
})

export const DELETE: Endpoint = defineRoute({
  method: 'DELETE',
  path: '/api/engine/workspaces/{workspaceId}/members/{memberId}',
  summary: 'Remove a member from the workspace',
  tags: ['engine'],
  output: okSchema,
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'admin',
      async (access) => {
        await removeMember(
          access.workspace.id,
          access.auth.id,
          requireParam(params, 'memberId'),
          requestIp(request),
        )
        return { ok: true as const }
      },
    ),
})
