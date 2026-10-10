import { randomId } from '@mtd/helpers'
import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { notifyUser } from '~/api/notify'
import { drizzle } from '~/database/db'
import { mtdSubmissionJob } from '~/database/schema'
import { getTaxYearStart, parseTaxYearStart } from '~/features/mtd/utils/quarterPeriods'
import { getBoss, JOB_NAMES } from '~/jobs/boss'

import type { Endpoint } from 'one'

const bodySchema = v.object({
  quarterId: v.string(),
  taxYearStart: v.optional(v.string()),
})

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/submissions/quarterly/jobs',
  summary: 'Enqueue a quarterly HMRC submission',
  tags: ['submissions'],
  input: bodySchema,
  output: v.object({
    jobId: v.string(),
    status: v.literal('pending'),
  }),
  handler: async (input, { request }) => {
    const auth = await requireApiAuth(request)
    const quarterId = input.quarterId
    const taxYearStart = parseTaxYearStart(input.taxYearStart) ?? getTaxYearStart()

    const jobId = randomId()
    const now = new Date().toISOString()
    await drizzle.insert(mtdSubmissionJob).values({
      id: jobId,
      userId: auth.id,
      quarterId,
      taxYearStart,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })

    const boss = await getBoss()
    await boss.send(
      JOB_NAMES.submissionSubmit,
      { jobId },
      { singletonKey: `submission-${auth.id}-${quarterId}-${taxYearStart}` },
    )

    await notifyUser(auth.id, { entity: 'submission', id: jobId, status: 'pending' })

    return { jobId, status: 'pending' as const }
  },
})
