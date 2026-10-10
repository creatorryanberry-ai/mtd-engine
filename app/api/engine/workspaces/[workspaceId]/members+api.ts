import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import {
  engineMembershipSchema,
  inviteMemberInputSchema,
} from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { requireParam } from '~/features/engine/core/server/httpError'
import {
  addMemberByEmail,
  listMembers,
} from '~/features/engine/core/server/membershipService'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/members',
  summary: 'List workspace members',
  tags: ['engine'],
  output: v.object({ items: v.array(engineMembershipSchema) }),
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      async (access) => ({
        items: await listMembers(access.workspace.id, access.auth.id),
      }),
    ),
})

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/members',
  summary: 'Add an existing user to the workspace by email',
  tags: ['engine'],
  input: inviteMemberInputSchema,
  output: engineMembershipSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(request, requireParam(params, 'workspaceId'), 'admin', (access) =>
      addMemberByEmail(access.workspace.id, access.auth.id, input, requestIp(request)),
    ),
})
