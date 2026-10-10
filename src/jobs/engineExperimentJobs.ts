import { enterBypassRlsContext } from '@mtd/database'
import { eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineExperiment, engineWorkspace } from '~/database/engineSchema'
import { systemActor, writeAudit } from '~/features/engine/core/server/audit'
import { assignPopulation } from '~/features/engine/measure/server/assignment'
import { transitionExperiment } from '~/features/engine/measure/server/experimentService'
import {
  parseStoredResult,
  refreshExperimentResult,
} from '~/features/engine/measure/server/results'
import { JOB_NAMES } from '~/jobs/boss'

import type { Job, PgBoss } from 'pg-boss'

const REFRESH_CRON = '20 * * * *'
const ANALYST = systemActor('analyst')

export type ExperimentsRefreshSummary = {
  refreshed: number
  completed: number
  assigned: number
  failed: number
}

/** every running experiment: assign newcomers, complete past endsAt, recompute the result */
export async function refreshRunningExperiments(
  now = new Date(),
  jobId: string | null = null,
): Promise<ExperimentsRefreshSummary> {
  const rows = await drizzle
    .select({ experiment: engineExperiment, workspace: engineWorkspace })
    .from(engineExperiment)
    .innerJoin(engineWorkspace, eq(engineWorkspace.id, engineExperiment.workspaceId))
    .where(eq(engineExperiment.status, 'running'))

  const summary: ExperimentsRefreshSummary = {
    refreshed: 0,
    completed: 0,
    assigned: 0,
    failed: 0,
  }
  for (const { experiment, workspace } of rows) {
    try {
      if (experiment.endsAt && Date.parse(experiment.endsAt) <= now.getTime()) {
        await transitionExperiment({
          workspace,
          experimentId: experiment.id,
          to: 'completed',
          reason: 'end date reached; completed automatically and the final result stored',
          actor: ANALYST,
          now,
        })
        summary.completed += 1
        continue
      }

      const population = await assignPopulation(experiment.id)
      const previous = parseStoredResult(experiment.result)
      const result = await refreshExperimentResult(experiment.id, now)
      summary.assigned += population.assigned
      summary.refreshed += 1

      // hourly recomputes only reach the audit log when something a reader would act on changed
      const changed =
        population.assigned > 0 ||
        previous?.primary?.verdict !== result.primary?.verdict ||
        previous?.srm.mismatch !== result.srm.mismatch
      if (!changed) continue
      await writeAudit({
        workspaceId: workspace.id,
        actor: ANALYST,
        action: 'experiment.refresh',
        entityType: 'experiment',
        entityId: experiment.id,
        before: previous
          ? {
              verdict: previous.primary?.verdict ?? null,
              srmMismatch: previous.srm.mismatch,
            }
          : null,
        after: {
          assigned: population.assigned,
          excluded: population.excluded,
          verdict: result.primary?.verdict ?? null,
          srmMismatch: result.srm.mismatch,
          groups: result.groups.map((group) => ({ key: group.key, n: group.n })),
        },
        reasoning: 'scheduled refresh: newcomers assigned and result recomputed',
        evidence: { jobId },
      })
    } catch (error) {
      summary.failed += 1
      console.error('[worker] engine experiment refresh failed', experiment.id, error)
    }
  }
  return summary
}

export async function registerEngineExperimentJobs(boss: PgBoss) {
  await boss.work(JOB_NAMES.engineExperimentsRefresh, async ([job]: Job[]) => {
    enterBypassRlsContext()
    const summary = await refreshRunningExperiments(new Date(), job?.id ?? null)
    console.info('[worker] engine experiments refresh', summary)
    if (summary.failed > 0) {
      throw new Error(`experiment refresh failed for ${summary.failed} experiment(s)`)
    }
  })

  await boss.schedule(JOB_NAMES.engineExperimentsRefresh, REFRESH_CRON)
}
