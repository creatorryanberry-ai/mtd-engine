import { defineRoute } from '~/api/defineRoute'
import {
  engineExperimentSchema,
  updateExperimentInputSchema,
} from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import {
  getExperiment,
  updateExperiment,
} from '~/features/engine/measure/server/experimentService'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/experiments/{experimentId}',
  summary: 'Get an experiment',
  tags: ['engine'],
  output: engineExperimentSchema,
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) =>
        getExperiment(access.workspace.id, requireParam(params, 'experimentId')),
    ),
})

export const PATCH: Endpoint = defineRoute({
  method: 'PATCH',
  path: '/api/engine/workspaces/{workspaceId}/experiments/{experimentId}',
  summary: 'Update an experiment',
  tags: ['engine'],
  input: updateExperimentInputSchema,
  output: engineExperimentSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      (access) =>
        updateExperiment(
          access.workspace,
          access.auth.id,
          requireParam(params, 'experimentId'),
          input,
          requestIp(request),
        ),
    ),
})
