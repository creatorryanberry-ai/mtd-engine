import { defineRoute } from '~/api/defineRoute'
import {
  engineExperimentSchema,
  transitionExperimentInputSchema,
} from '~/features/engine/contract'
import { requestIp, userActor } from '~/features/engine/core/server/audit'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { transitionExperiment } from '~/features/engine/measure/server/experimentService'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/experiments/{experimentId}/transition',
  summary: 'Start, pause, complete or abort an experiment',
  tags: ['engine'],
  input: transitionExperimentInputSchema,
  output: engineExperimentSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'marketer',
      (access) =>
        transitionExperiment({
          workspace: access.workspace,
          experimentId: requireParam(params, 'experimentId'),
          to: input.to,
          reason: input.reason,
          actor: userActor(access.auth.id),
          ipAddress: requestIp(request),
        }),
    ),
})
