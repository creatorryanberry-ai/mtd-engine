import * as v from 'valibot'

import { errorResponseSchema } from '~/contract'
import {
  attributionQuerySchema,
  attributionReportSchema,
  incrementalQuerySchema,
  incrementalReportSchema,
  metricsDailyQuerySchema,
  metricsDailyRowSchema,
  metricsRollupInputSchema,
  metricsRollupResponseSchema,
} from '~/features/engine/contract'

import { engineRoute, forbidden, notFound, unauthorized } from './engine'

/** phase 2 measurement routes: incremental profit, attribution, daily metrics */
export const engineMeasureRegistered = true

const WS = '/api/engine/workspaces/{workspaceId}'
const badRequest = {
  status: 400,
  description: 'Invalid range or parameters',
  schema: errorResponseSchema,
}

engineRoute({
  method: 'GET',
  path: `${WS}/incremental`,
  summary: 'Incremental gross profit against the permanent holdout',
  description:
    'Intent to treat: every contact created before `to` counts in its group, split by hash bucket. Welch 95% interval on gross profit per contact, scaled by treated contacts. `from` defaults to monday of this week (utc), `to` (exclusive) to now. Verdict stays collecting below 100 contacts per group.',
  role: 'viewer',
  input: incrementalQuerySchema,
  output: incrementalReportSchema,
  errorResponses: [badRequest, unauthorized, forbidden, notFound],
})

engineRoute({
  method: 'GET',
  path: `${WS}/attribution`,
  summary: 'Triangulated channel attribution',
  description:
    'First-party multi-touch credit (every model), platform-reported numbers and holdout-backed experiment lift side by side, never blended; disagreements are flagged. Window [from, to) in utc days, default the last 28 days including today; model defaults to last_touch and lookbackDays (1..90) to 30.',
  role: 'viewer',
  input: attributionQuerySchema,
  output: attributionReportSchema,
  errorResponses: [badRequest, unauthorized, forbidden, notFound],
})

engineRoute({
  method: 'GET',
  path: `${WS}/metrics/daily`,
  summary: 'Daily metrics rollup rows',
  description:
    "Inclusive utc day range, oldest first; defaults to the last 28 days, capped at 366. Every channel including 'all' unless channelKey is given.",
  role: 'viewer',
  input: metricsDailyQuerySchema,
  output: v.object({ items: v.array(metricsDailyRowSchema) }),
  errorResponses: [badRequest, unauthorized, forbidden, notFound],
})

engineRoute({
  method: 'POST',
  path: `${WS}/metrics/rollup`,
  summary: 'Recompute daily metrics',
  description:
    'Rebuilds engineMetricsDaily for an inclusive utc day range, default the last 7 days; longer than 120 days keeps the most recent 120. Writes an audit entry. The worker also runs this nightly at 02:15 utc for the last 3 days.',
  role: 'admin',
  input: metricsRollupInputSchema,
  output: metricsRollupResponseSchema,
  errorResponses: [badRequest, unauthorized, forbidden, notFound],
})
