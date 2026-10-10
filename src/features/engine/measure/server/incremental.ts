import { and, count, eq, gte, isNull, lt, notInArray, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineContact, engineOrder, engineOutcome } from '~/database/engineSchema'

import { OUTCOME_TYPES } from '../attribution'
import { buildIncrementalReport, holdoutBucketThreshold } from '../incrementalReport'
import { NON_REVENUE_ORDER_STATUSES } from './touches'

import type { IncrementalReportDto } from '../../contract'
import type { Moments } from '../stats'
import type { EngineWorkspace } from '~/database/engineSchema'

/**
 * incremental gross profit against the permanent holdout over [from, to).
 * population: every contact created before `to` (intent to treat), split by
 * hashBucket < threshold; each contact's value is its outcome gross profit in
 * the window (0 when none). sql returns moments so rows never leave the db.
 */
export async function computeIncrementalReport(
  workspace: Pick<EngineWorkspace, 'id' | 'currency' | 'globalHoldoutRate'>,
  window: { from: string; to: string },
): Promise<IncrementalReportDto> {
  const threshold = holdoutBucketThreshold(workspace.globalHoldoutRate)
  const outcomeTypes = sql.join(
    OUTCOME_TYPES.map((type) => sql`${type}`),
    sql`, `,
  )

  const [groups, [unattributed]] = await Promise.all([
    drizzle.execute<{ isHoldout: boolean; n: number; sum: number; sumSq: number }>(sql`
      WITH profit AS (
        SELECT ${engineOutcome.contactId} AS "contactId",
               sum(${engineOutcome.grossProfitMinor})::float8 AS gp
        FROM ${engineOutcome}
        WHERE ${engineOutcome.workspaceId} = ${workspace.id}
          AND ${engineOutcome.contactId} IS NOT NULL
          AND ${engineOutcome.type} IN (${outcomeTypes})
          AND ${engineOutcome.occurredAt} >= ${window.from}
          AND ${engineOutcome.occurredAt} < ${window.to}
        GROUP BY 1
      )
      SELECT (c."hashBucket" < ${threshold}) AS "isHoldout",
             count(*)::int AS n,
             coalesce(sum(p.gp), 0)::float8 AS sum,
             coalesce(sum(p.gp * p.gp), 0)::float8 AS "sumSq"
      FROM ${engineContact} c
      LEFT JOIN profit p ON p."contactId" = c.id
      WHERE c."workspaceId" = ${workspace.id}
        AND c."createdAt" < ${window.to}
      GROUP BY 1
    `),
    drizzle
      .select({ total: count() })
      .from(engineOrder)
      .where(
        and(
          eq(engineOrder.workspaceId, workspace.id),
          isNull(engineOrder.contactId),
          gte(engineOrder.occurredAt, window.from),
          lt(engineOrder.occurredAt, window.to),
          notInArray(engineOrder.status, NON_REVENUE_ORDER_STATUSES),
        ),
      ),
  ])

  const empty: Moments = { n: 0, sum: 0, sumSq: 0 }
  let treated = empty
  let holdout = empty
  for (const row of groups.rows) {
    const moments = { n: Number(row.n), sum: Number(row.sum), sumSq: Number(row.sumSq) }
    if (row.isHoldout) holdout = moments
    else treated = moments
  }

  return buildIncrementalReport({
    windowFrom: window.from,
    windowTo: window.to,
    currency: workspace.currency,
    holdoutRate: workspace.globalHoldoutRate,
    treated,
    holdout,
    unattributedOrders: unattributed?.total ?? 0,
  })
}
