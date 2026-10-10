import { defineRoute } from '~/api/defineRoute'
import { errorResponseSchema } from '~/contract'
import {
  engineLlmCallSummarySchema,
  pageSchema,
  paginatedQuerySchema,
} from '~/features/engine/contract'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { listLlmCalls } from '~/features/engine/llm/calls'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/llm/calls',
  summary: 'List recent LLM calls with cost',
  description:
    'Every call through the gateway, newest first, with tokens, cost and latency. Prompts and outputs are not included.',
  tags: ['engine'],
  input: paginatedQuerySchema,
  output: pageSchema(engineLlmCallSummarySchema),
  errorResponses: [
    { status: 403, description: 'Requires admin role', schema: errorResponseSchema },
    { status: 404, description: 'Workspace not found', schema: errorResponseSchema },
  ],
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'admin',
      ({ workspace }) => {
        // defineRoute types the handler input as the schema input (string); the value is already parsed
        const limit = input.limit === undefined ? undefined : Number(input.limit)
        return listLlmCalls(workspace.id, { limit, cursor: input.cursor })
      },
    ),
})
