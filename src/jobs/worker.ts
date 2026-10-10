import {
  enterBypassRlsContext,
  enterUserDbContext,
  runWithUserDbContextAsync,
} from '@mtd/database'
import { eq } from 'drizzle-orm'

import { notifyUser } from '~/api/notify'
import { drizzle } from '~/database/db'
import { mtdSubmissionJob } from '~/database/schema'
import { runConnectionSync } from '~/features/engine/channels/server/connectionService'
import { writeAudit } from '~/features/engine/core/server/audit'
import { submitQuarterlyUpdate } from '~/features/submission/server/submissionService'
import { getBoss, JOB_NAMES } from '~/jobs/boss'
import { registerEngineExperimentJobs } from '~/jobs/engineExperimentJobs'
import { registerEngineMeasureJobs } from '~/jobs/engineMeasureJobs'

import type { SyncJobData } from '~/features/engine/channels/server/connectionService'
import type { Job } from 'pg-boss'

export async function registerJobHandlers() {
  const boss = await getBoss()

  await boss.work(JOB_NAMES.submissionSubmit, async ([job]: Job[]) => {
    const { jobId } = job.data as { jobId: string }
    // lookup with bypass (no user context yet)
    const rows = await drizzle
      .select()
      .from(mtdSubmissionJob)
      .where(eq(mtdSubmissionJob.id, jobId))
      .limit(1)
    const row = rows[0]
    if (!row || row.status === 'accepted') return

    await runWithUserDbContextAsync(row.userId, async () => {
      enterUserDbContext(row.userId)

      await drizzle
        .update(mtdSubmissionJob)
        .set({ status: 'submitting', updatedAt: new Date().toISOString() })
        .where(eq(mtdSubmissionJob.id, jobId))

      try {
        const result = await submitQuarterlyUpdate(row.userId, row.quarterId, {
          taxYearStart: row.taxYearStart,
        })
        await drizzle
          .update(mtdSubmissionJob)
          .set({
            status: 'accepted',
            reference: result.reference,
            submittedAt: result.submittedAt,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(mtdSubmissionJob.id, jobId))
        await notifyUser(row.userId, {
          entity: 'submission',
          id: jobId,
          status: 'accepted',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await drizzle
          .update(mtdSubmissionJob)
          .set({
            status: 'rejected',
            error: message,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(mtdSubmissionJob.id, jobId))
        await notifyUser(row.userId, {
          entity: 'submission',
          id: jobId,
          status: 'rejected',
        })
        throw error
      }
    })
  })

  // connector syncs act as the connector, not a user: bypass rls, audit as connector:<provider>
  await boss.work(JOB_NAMES.engineConnectionSync, async ([job]: Job[]) => {
    const { connectionId, scope } = job.data as SyncJobData
    enterBypassRlsContext()
    console.info('[worker] engine sync', connectionId, scope)
    try {
      const summary = await runConnectionSync(connectionId, scope)
      await writeAudit({
        workspaceId: summary.workspaceId,
        actor: `connector:${summary.provider}`,
        action: summary.skippedReason ? 'connection.sync.skipped' : 'connection.sync',
        entityType: 'connection',
        entityId: connectionId,
        after: {
          scope,
          pages: summary.pages,
          created: summary.created,
          updated: summary.updated,
          skipped: summary.skipped,
          errors: summary.errors.length,
          hasMore: summary.hasMore,
          requeuedJobId: summary.requeuedJobId,
        },
        reasoning: summary.skippedReason,
        evidence: { jobId: job.id, errors: summary.errors.slice(0, 20) },
      })
    } catch (error) {
      console.error('[worker] engine sync failed', connectionId, error)
      throw error
    }
  })

  await registerEngineExperimentJobs(boss)
  await registerEngineMeasureJobs(boss)
}

if (import.meta.main) {
  console.info('[worker] starting pg-boss handlers')
  await registerJobHandlers()
  console.info('[worker] ready')
}
