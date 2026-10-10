import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import {
  metricsDailyQuerySchema,
  metricsDailyRowSchema,
} from '~/features/engine/contract'
import { httpError, requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { resolveDayRange, utcDay } from '~/features/engine/measure/metricsMath'
import { listMetricsDaily } from '~/features/engine/measure/server/metricsRollup'

import type { Endpoint } from 'one'

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/metrics/daily',
  summary: 'Daily metrics rollup rows',
  description:
    "Inclusive utc day range, oldest first; defaults to the last 28 days and is capped at 366 days. Every channel (including 'all') unless channelKey is given.",
  tags: ['engine'],
  input: metricsDailyQuerySchema,
  output: v.object({ items: v.array(metricsDailyRowSchema) }),
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => {
        const range = resolveDayRange({
          from: input.from,
          to: input.to,
          today: utcDay(new Date()),
          defaultDays: 28,
          maxDays: 366,
        })
        if (!range) throw httpError(400, '`from` must not be after `to`')
        return listMetricsDaily(access.workspace.id, {
          fromDay: range.fromDay,
          toDay: range.toDay,
          channelKey: input.channelKey,
        })
      },
    ),
})
