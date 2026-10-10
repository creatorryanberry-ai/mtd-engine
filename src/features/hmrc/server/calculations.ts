import {
  HMRC_TAX_ESTIMATE_DISCLAIMER,
  HMRC_PRODUCTION_ACCOUNT_URL,
} from '~/features/hmrc/constants'
import { formatHmrcTaxYear } from '~/features/mtd/utils/quarterPeriods'
import { getHmrcUrls } from './config'

import { hmrcApiRequest, getValidHmrcAccessToken } from './client'

import type { HmrcFraudHeadersInput, HmrcTaxEstimate } from '../types'

type TriggerCalculationResponse = {
  calculationId: string
}

type RetrieveCalculationResponse = {
  calculation?: {
    taxCalculation?: {
      incomeTax?: {
        totalIncomeReceivedFromAllSources?: number
        totalTaxableIncome?: number
        incomeTaxCharged?: number
        payPensionsProfit?: {
          incomeTaxAmount?: number
        }
      }
      nics?: {
        class2NicsAmount?: number
        class4NicsAmount?: number
      }
      totalIncomeTaxAndNicsDue?: number
      totalTaxDeducted?: number
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function roundMoney(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return Math.round(value * 100) / 100
}

export async function getHmrcInYearTaxEstimate(input: {
  userId: string
  taxYearStart: string
  request: Request
  fraudHeaders?: HmrcFraudHeadersInput
}): Promise<HmrcTaxEstimate> {
  const { accessToken, connection } = await getValidHmrcAccessToken(input.userId)
  const taxYear = formatHmrcTaxYear(input.taxYearStart)
  const nino = connection.nino

  const triggered = await hmrcApiRequest<TriggerCalculationResponse>({
    method: 'POST',
    path: `/individuals/calculations/${nino}/self-assessment/${taxYear}/trigger/in-year`,
    accessToken,
    accept: 'application/vnd.hmrc.8.0+json',
    request: input.request,
    fraudHeaders: input.fraudHeaders,
  })

  await sleep(5000)

  const calculation = await hmrcApiRequest<RetrieveCalculationResponse>({
    path: `/individuals/calculations/${nino}/self-assessment/${taxYear}/${triggered.calculationId}`,
    accessToken,
    accept: 'application/vnd.hmrc.8.0+json',
    request: input.request,
    fraudHeaders: input.fraudHeaders,
  })

  const taxCalculation = calculation.calculation?.taxCalculation
  const incomeTaxAmount = roundMoney(
    taxCalculation?.incomeTax?.payPensionsProfit?.incomeTaxAmount ??
      taxCalculation?.incomeTax?.incomeTaxCharged,
  )
  const class2 = roundMoney(taxCalculation?.nics?.class2NicsAmount) ?? 0
  const class4 = roundMoney(taxCalculation?.nics?.class4NicsAmount) ?? 0

  return {
    calculationId: triggered.calculationId,
    taxYear,
    incomeTaxAmount,
    totalIncomeTaxAndNicsDue: roundMoney(taxCalculation?.totalIncomeTaxAndNicsDue),
    totalTaxDeducted: roundMoney(taxCalculation?.totalTaxDeducted),
    totalNicAmount: roundMoney(class2 + class4),
    disclaimer: HMRC_TAX_ESTIMATE_DISCLAIMER,
    hmrcAccountUrl: getHmrcUrls().accountUrl || HMRC_PRODUCTION_ACCOUNT_URL,
    retrievedAt: new Date().toISOString(),
  }
}
