import { defineRoute } from '~/api/defineRoute'
import {
  engineContactSchema,
  pageSchema,
  paginatedQuerySchema,
} from '~/features/engine/contract'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { listContacts } from '~/features/engine/sense/server/contacts'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/contacts',
  summary: 'Contacts, newest first',
  tags: ['engine'],
  input: paginatedQuerySchema,
  output: pageSchema(engineContactSchema),
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => listContacts(access.workspace.id, input),
    ),
})
