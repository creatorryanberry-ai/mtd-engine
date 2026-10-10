import { defineRoute } from '~/api/defineRoute'
import {
  attributionQuerySchema,
  attributionReportSchema,
} from '~/features/engine/contract'
import { httpError, requireParam } from '~/features/engine/core/server/httpError'
import { withWorkspaceAccess } from '~/features/engine/core/server/workspaceAccess'
import { DEFAULT_LOOKBACK_DAYS } from '~/features/engine/measure/attribution'
import { addDays, dayDiff, utcDay } from '~/features/engine/measure/metricsMath'
import { buildAttributionReport } from '~/features/engine/measure/server/attributionService'

import type { Endpoint } from 'one'

const DEFAULT_WINDOW_DAYS = 28
const MAX_WINDOW_DAYS = 366

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/engine/workspaces/{workspaceId}/attribution',
  summary: 'Triangulated channel attribution',
  description:
    'First-party multi-touch credit beside platform-reported numbers and holdout-backed experiment lift, never blended; disagreements are flagged. Window [from, to) in utc days, default the last 28 days including today; model defaults to last_touch, lookbackDays (1..90) to 30.',
  tags: ['engine'],
  input: attributionQuerySchema,
  output: attributionReportSchema,
  handler: (input, { request, params }) =>
    withWorkspaceAccess(
      request,
      requireParam(params, 'workspaceId'),
      'viewer',
      (access) => {
        const to = input.to ?? addDays(utcDay(new Date()), 1)
        const from = input.from ?? addDays(to, -DEFAULT_WINDOW_DAYS)
        const span = dayDiff(from, to)
        if (span <= 0) throw httpError(400, '`from` must be before `to`')
        if (span > MAX_WINDOW_DAYS) {
          throw httpError(400, `window is limited to ${MAX_WINDOW_DAYS} days`)
        }
        const lookbackDays = input.lookbackDays
          ? Number(input.lookbackDays)
          : DEFAULT_LOOKBACK_DAYS
        if (!(lookbackDays >= 1 && lookbackDays <= 90)) {
          throw httpError(400, 'lookbackDays must be between 1 and 90')
        }
        return buildAttributionReport(access.workspace, {
          from,
          to,
          model: input.model ?? 'last_touch',
          lookbackDays,
        })
      },
    ),
})
