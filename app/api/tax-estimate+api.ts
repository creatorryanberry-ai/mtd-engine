import { jsonError, requireAuth } from '~/server/apiHelpers'
import { getCurrentQuarter, parseTaxYearStart } from '~/features/mtd/utils/quarterPeriods'
import {
  getTaxEstimate,
  updateTaxEstimate,
} from '~/features/taxEstimate/server/taxEstimateService'
import type { TaxEstimateAnswers } from '~/features/taxEstimate/types'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const taxYearStart =
      parseTaxYearStart(url.searchParams.get('taxYearStart')) ??
      getCurrentQuarter().taxYearStart

    const estimate = await getTaxEstimate(authData.id, taxYearStart)
    return Response.json(estimate)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[tax-estimate] get error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load tax estimate',
      500,
    )
  }
}

export const PATCH: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as {
      taxYearStart?: string
      jurisdiction?: string
      useProjection?: boolean
      answers?: Partial<TaxEstimateAnswers>
    }
    const taxYearStart =
      parseTaxYearStart(body.taxYearStart) ?? getCurrentQuarter().taxYearStart

    const estimate = await updateTaxEstimate(authData.id, {
      taxYearStart,
      jurisdiction: body.jurisdiction,
      useProjection: body.useProjection,
      answers: body.answers,
    })
    return Response.json(estimate)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[tax-estimate] update error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to update tax estimate',
      500,
    )
  }
}
