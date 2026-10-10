import type { Pence } from './money'
import { getTaxRoundingPolicy } from './rounding'
import type { TaxYearRules } from './taxYearRules'

export function defaultChildBenefitPence(
  numberOfChildren: number,
  rules: TaxYearRules,
): Pence {
  const children = Math.max(0, Math.floor(numberOfChildren))
  if (children <= 0) return 0
  const weekly =
    rules.childBenefitFirstChildWeeklyPence +
    rules.childBenefitAdditionalChildWeeklyPence * (children - 1)
  return weekly * rules.childBenefitWeeks
}

export function calculateHighIncomeChildBenefitCharge(input: {
  adjustedNetIncomePence: Pence
  childBenefitPence: Pence
  receivedByUser: boolean
  rules: TaxYearRules
}): Pence {
  if (!input.receivedByUser || input.childBenefitPence <= 0) return 0
  if (input.adjustedNetIncomePence <= input.rules.hicbcThresholdPence) return 0

  const aniPounds = Math.floor(input.adjustedNetIncomePence / 100)
  const thresholdPounds = Math.floor(input.rules.hicbcThresholdPence / 100)
  const percent = Math.min(
    100,
    Math.floor((aniPounds - thresholdPounds) / input.rules.hicbcStepPounds),
  )

  return getTaxRoundingPolicy().applyRate(input.childBenefitPence, percent / 100)
}
