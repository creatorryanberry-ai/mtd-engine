import { defineRoute } from '~/api/defineRoute'
import {
  incrementalQuerySchema,
  incrementalReportSchema,
} from '~/features/engine/contract'
import { httpError, requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { dayStartIso } from '~/features/engine/measure/metricsMath'
import { computeIncrementalReport } from '~/features/engine/measure/server/incremental'
import { weekStart } from '~/features/engine/sense/server/dashboard'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/incremental',
  summary: 'Incremental gross profit against the permanent holdout',
  description:
    'Intent to treat: every contact created before `to` counts in its group. `from` defaults to the start of this week (monday utc), `to` (exclusive) to now.',
  tags: ['engine'],
  input: incrementalQuerySchema,
  output: incrementalReportSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => {
        const now = new Date()
        const from = input.from ? dayStartIso(input.from) : weekStart(now).toISOString()
        const to = input.to ? dayStartIso(input.to) : now.toISOString()
        if (Date.parse(from) >= Date.parse(to)) {
          throw httpError(400, '`from` must be before `to`')
        }
        return computeIncrementalReport(access.workspace, { from, to })
      },
    ),
})
