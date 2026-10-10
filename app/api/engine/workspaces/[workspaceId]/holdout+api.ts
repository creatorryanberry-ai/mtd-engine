import { defineRoute } from '~/api/defineRoute'
import { globalHoldoutStatusSchema } from '~/features/engine/contract'
import { requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { getGlobalHoldoutStatus } from '~/features/engine/measure/server/experimentService'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/holdout',
  summary: 'Permanent workspace holdout: rate and contacts held out',
  tags: ['engine'],
  output: globalHoldoutStatusSchema,
  handler: (_input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => getGlobalHoldoutStatus(access.workspace),
    ),
})
