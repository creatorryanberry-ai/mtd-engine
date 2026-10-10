import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import {
  createWorkspaceInputSchema,
  engineWorkspaceListItemSchema,
} from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { withEngineAuth } from '~/features/engine/core/server/workspaceAccess'
import {
  createWorkspace,
  listWorkspacesForUser,
} from '~/features/engine/core/server/workspaceService'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces',
  summary: 'List engine workspaces the current user belongs to',
  tags: ['engine'],
  output: v.object({ items: v.array(engineWorkspaceListItemSchema) }),
  handler: (_input, { request }) =>
    withEngineAuth(request, async (auth) => ({
      items: await listWorkspacesForUser(auth.id),
    })),
})

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces',
  summary: 'Create an engine workspace owned by the current user',
  tags: ['engine'],
  input: createWorkspaceInputSchema,
  output: engineWorkspaceListItemSchema,
  handler: (input, { request }) =>
    withEngineAuth(request, (auth) =>
      createWorkspace(auth.id, input, requestIp(request)),
    ),
})
