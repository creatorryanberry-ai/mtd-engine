import {
  formatHmrcTaxYear,
  usesCumulativeHmrcSubmission,
} from '~/features/mtd/utils/quarterPeriods'

import { hmrcApiRequest, getValidHmrcAccessToken } from './client'
import { mapCategoryLinesToHmrcPeriodSummary } from './mapSubmission'
import { ensureDefaultSelfEmploymentBusiness } from './businessDetails'

import type { HmrcFraudHeadersInput } from '../types'
import type { SubmissionCategoryLine } from '~/features/submission/server/submissionService'

type CreatePeriodSummaryResponse = {
  periodId?: string
}

export async function submitSelfEmploymentQuarterlyUpdate(input: {
  userId: string
  request: Request
  fraudHeaders?: HmrcFraudHeadersInput
  categoryLines: SubmissionCategoryLine[]
  taxYearStart: string
  periodEnd: string
  quarterId: string
}) {
  await ensureDefaultSelfEmploymentBusiness({
    userId: input.userId,
    request: input.request,
    fraudHeaders: input.fraudHeaders,
  })

  const { accessToken, connection } = await getValidHmrcAccessToken(input.userId)
  if (!connection.businessId) {
    throw new Error('No self-employment business selected')
  }

  const payload = mapCategoryLinesToHmrcPeriodSummary({
    categoryLines: input.categoryLines,
    taxYearStart: input.taxYearStart,
    periodEnd: input.periodEnd,
  })

  const taxYear = formatHmrcTaxYear(input.taxYearStart)
  const nino = connection.nino
  const businessId = connection.businessId

  if (usesCumulativeHmrcSubmission(input.taxYearStart)) {
    await hmrcApiRequest<void>({
      method: 'PUT',
      path: `/individuals/business/self-employment/${nino}/${businessId}/cumulative/${taxYear}`,
      accessToken,
      accept: 'application/vnd.hmrc.5.0+json',
      body: payload,
      request: input.request,
      fraudHeaders: input.fraudHeaders,
      govTestScenario: process.env.IS_TESTING ? 'STATEFUL' : undefined,
    })

    return {
      reference: `${businessId}-${taxYear}-${input.periodEnd}`,
      hmrcPeriodId: `${input.quarterId}-${input.periodEnd}`,
      source: 'hmrc' as const,
    }
  }

  const response = await hmrcApiRequest<CreatePeriodSummaryResponse>({
    method: 'POST',
    path: `/individuals/business/self-employment/${nino}/${businessId}/period`,
    accessToken,
    accept: 'application/vnd.hmrc.5.0+json',
    body: payload,
    request: input.request,
    fraudHeaders: input.fraudHeaders,
    govTestScenario: process.env.IS_TESTING ? 'STATEFUL' : undefined,
  })

  return {
    reference: response.periodId ?? `${businessId}-${input.periodEnd}`,
    hmrcPeriodId: response.periodId ?? null,
    source: 'hmrc' as const,
  }
}
