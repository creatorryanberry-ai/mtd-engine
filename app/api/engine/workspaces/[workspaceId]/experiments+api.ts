import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import {
  createExperimentInputSchema,
  engineExperimentSchema,
} from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import {
  createExperiment,
  listExperiments,
} from '~/features/engine/measure/server/experimentService'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/experiments',
  summary: 'List experiments with arms, assigned counts and stored results',
  tags: ['engine'],
  output: v.object({ items: v.array(engineExperimentSchema) }),
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      async (access) => ({ items: await listExperiments(access.workspace.id) }),
    ),
})

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/experiments',
  summary: 'Create a draft experiment',
  tags: ['engine'],
  input: createExperimentInputSchema,
  output: engineExperimentSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      (access) =>
        createExperiment(access.workspace, access.auth.id, input, requestIp(request)),
    ),
})
