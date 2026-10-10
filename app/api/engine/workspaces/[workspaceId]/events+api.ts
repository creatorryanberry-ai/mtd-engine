import { defineRoute } from '~/api/defineRoute'
import {
  engineEventSchema,
  ingestEventsInputSchema,
  ingestEventsResponseSchema,
  pageSchema,
  paginatedQuerySchema,
} from '~/features/engine/contract'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { ingestEvents, listEvents } from '~/features/engine/sense/server/events'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/events',
  summary: 'Ingest a batch of events',
  tags: ['engine'],
  input: ingestEventsInputSchema,
  output: ingestEventsResponseSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      (access) => ingestEvents(access.workspace.id, input.events, 'api'),
    ),
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/events',
  summary: 'Recent events, newest first',
  tags: ['engine'],
  input: paginatedQuerySchema,
  output: pageSchema(engineEventSchema),
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => listEvents(access.workspace.id, input),
    ),
})
