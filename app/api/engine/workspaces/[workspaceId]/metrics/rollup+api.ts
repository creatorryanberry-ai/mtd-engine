import { defineRoute } from '~/api/defineRoute'
import {
  metricsRollupInputSchema,
  metricsRollupResponseSchema,
} from '~/features/engine/contract'
import { requestIp, userActor, writeAudit } from '~/features/engine/core/server/audit'
import { httpError, requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { resolveDayRange, utcDay } from '~/features/engine/measure/metricsMath'
import { rollupWorkspaceDays } from '~/features/engine/measure/server/metricsRollup'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/engine/workspaces/{workspaceId}/metrics/rollup',
  summary: 'Recompute daily metrics',
  description:
    'Rebuilds engineMetricsDaily for an inclusive utc day range (default the last 7 days). Ranges longer than 120 days keep the most recent 120. Audited.',
  tags: ['engine'],
  input: metricsRollupInputSchema,
  output: metricsRollupResponseSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'admin',
      async ({ auth, workspace }) => {
        const range = resolveDayRange({
          from: input.from,
          to: input.to,
          today: utcDay(new Date()),
          defaultDays: 7,
          maxDays: 120,
        })
        if (!range) throw httpError(400, '`from` must not be after `to`')
        const result = await rollupWorkspaceDays(workspace.id, range.fromDay, range.toDay)
        await writeAudit({
          workspaceId: workspace.id,
          actor: userActor(auth.id),
          action: 'metrics.rollup',
          entityType: 'metricsDaily',
          after: { fromDay: range.fromDay, toDay: range.toDay, ...result },
          ipAddress: requestIp(request),
        })
        return result
      },
    ),
})
