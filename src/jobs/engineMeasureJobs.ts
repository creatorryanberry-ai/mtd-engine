import { enterBypassRlsContext } from '@mtd/database'

import { systemActor, writeAudit } from '~/features/engine/core/server/audit'
import { addDays, isDay, utcDay } from '~/features/engine/measure/metricsMath'
import { rollupAllWorkspaces } from '~/features/engine/measure/server/metricsRollup'
import { JOB_NAMES } from '~/jobs/boss'

import type { Job, PgBoss } from 'pg-boss'

/** nightly rollup covers the last few days so late events and refunds land */
const ROLLUP_TRAILING_DAYS = 3
const ROLLUP_CRON = '15 2 * * *'

type RollupJobData = { fromDay?: string; toDay?: string }

function readJobData(job: Job | undefined): RollupJobData {
  const data = job?.data
  if (!data || typeof data !== 'object') return {}
  const { fromDay, toDay } = data as Record<string, unknown>
  return {
    fromDay: typeof fromDay === 'string' && isDay(fromDay) ? fromDay : undefined,
    toDay: typeof toDay === 'string' && isDay(toDay) ? toDay : undefined,
  }
}

/** daily metrics rollup for every workspace; the analyst agent acts under rls bypass */
export async function registerEngineMeasureJobs(boss: PgBoss) {
  await boss.work(JOB_NAMES.engineMetricsRollup, async ([job]: Job[]) => {
    enterBypassRlsContext()
    const data = readJobData(job)
    const toDay = data.toDay ?? utcDay(new Date())
    const fromDay = data.fromDay ?? addDays(toDay, -(ROLLUP_TRAILING_DAYS - 1))
    console.info('[worker] engine metrics rollup', fromDay, toDay)

    const results = await rollupAllWorkspaces(fromDay, toDay)
    for (const result of results) {
      await writeAudit({
        workspaceId: result.workspaceId,
        actor: systemActor('analyst'),
        action: result.error ? 'metrics.rollup.failed' : 'metrics.rollup',
        entityType: 'metricsDaily',
        after: { fromDay, toDay, days: result.days, rows: result.rows },
        reasoning: result.error ?? undefined,
        evidence: { jobId: job?.id ?? null },
      })
    }
    const failed = results.filter((result) => result.error)
    if (failed.length > 0) {
      throw new Error(`metrics rollup failed for ${failed.length} workspace(s)`)
    }
  })

  await boss.schedule(JOB_NAMES.engineMetricsRollup, ROLLUP_CRON)
}
