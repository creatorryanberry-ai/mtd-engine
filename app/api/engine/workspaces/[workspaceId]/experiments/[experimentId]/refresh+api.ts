import { defineRoute } from '~/api/defineRoute'
import { experimentResultSchema } from '~/features/engine/contract'
import { requestIp } from '~/features/engine/core/server/audit'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { refreshExperiment } from '~/features/engine/measure/server/experimentService'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/experiments/{experimentId}/refresh',
  summary: 'Recompute and store the experiment result',
  tags: ['engine'],
  output: experimentResultSchema,
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      (access) =>
        refreshExperiment(
          access.workspace,
          access.auth.id,
          requireParam(params, 'experimentId'),
          requestIp(request),
        ),
    ),
})
