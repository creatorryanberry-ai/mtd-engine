import { poundsToPence, type Pence } from './money'
import { getTaxRoundingPolicy } from './rounding'
import type { TaxYearRules } from './taxYearRules'
import type { CgtResultStatus, TaxEstimateCapitalGainsAnswers } from './types'

export type CapitalGainsEstimate = {
  status: CgtResultStatus
  gainPence: Pence
  taxableGainPence: Pence
  taxPence: Pence
}

export function calculateCapitalGainsEstimate(input: {
  answers: TaxEstimateCapitalGainsAnswers
  remainingBasicRateRoomPence: Pence
  rules: TaxYearRules
}): CapitalGainsEstimate {
  if (input.answers.soldAssets !== 'yes') {
    return {
      status: 'exact_enough_for_estimate',
      gainPence: 0,
      taxableGainPence: 0,
      taxPence: 0,
    }
  }

  if (input.answers.types.includes('business')) {
    return {
      status: 'specialist_calculation_recommended',
      gainPence: 0,
      taxableGainPence: 0,
      taxPence: 0,
    }
  }

  const proceeds = poundsToPence(input.answers.proceedsPounds ?? 0)
  const cost = poundsToPence(input.answers.costPounds ?? 0)
  const incidental = poundsToPence(input.answers.incidentalCostsPounds ?? 0)
  const improvements = poundsToPence(input.answers.improvementCostsPounds ?? 0)
  const losses = poundsToPence(input.answers.lossesAvailablePounds ?? 0)

  if (input.answers.proceedsPounds == null || input.answers.costPounds == null) {
    return {
      status: 'needs_more_information',
      gainPence: 0,
      taxableGainPence: 0,
      taxPence: 0,
    }
  }

  const gain = Math.max(0, proceeds - cost - incidental - improvements - losses)
  const taxable = Math.max(0, gain - input.rules.cgtAnnualExemptPence)
  if (taxable <= 0) {
    return {
      status: 'exact_enough_for_estimate',
      gainPence: gain,
      taxableGainPence: 0,
      taxPence: 0,
    }
  }

  const rounding = getTaxRoundingPolicy()
  const basicSlice = Math.min(taxable, Math.max(0, input.remainingBasicRateRoomPence))
  const higherSlice = Math.max(0, taxable - basicSlice)
  const tax =
    rounding.applyRate(basicSlice, input.rules.cgtBasicRate) +
    rounding.applyRate(higherSlice, input.rules.cgtHigherRate)

  return {
    status: 'exact_enough_for_estimate',
    gainPence: gain,
    taxableGainPence: taxable,
    taxPence: tax,
  }
}
