import { poundsToPence, type Pence } from './money'
import { getTaxRoundingPolicy } from './rounding'
import type { TaxYearRules } from './taxYearRules'
import type { TaxEstimateAnswers } from './types'

export function grossUpReliefAtSource(netPence: Pence): Pence {
  if (netPence <= 0) return 0
  return getTaxRoundingPolicy().roundComponent((netPence * 100) / 80)
}

export function pensionGrossPence(answers: TaxEstimateAnswers): Pence {
  if (
    answers.reliefs.hadReliefs === 'no' ||
    answers.reliefs.pensionContributions === 'no'
  ) {
    return 0
  }
  const amount = poundsToPence(answers.reliefs.pensionContributionPounds ?? 0)
  if (amount <= 0) return 0
  return answers.reliefs.pensionContributionIsNet ? grossUpReliefAtSource(amount) : amount
}

export function giftAidGrossPence(answers: TaxEstimateAnswers): Pence {
  if (answers.reliefs.hadReliefs === 'no' || answers.reliefs.giftAid === 'no') {
    return 0
  }
  return grossUpReliefAtSource(poundsToPence(answers.reliefs.giftAidPounds ?? 0))
}

export function calculateAdjustedNetIncome(input: {
  totalIncomePence: Pence
  giftAidGrossPence: Pence
  pensionGrossPence: Pence
}): {
  totalIncomePence: Pence
  allowableAniAdjustmentsPence: Pence
  adjustedNetIncomePence: Pence
} {
  const adjustments = input.giftAidGrossPence + input.pensionGrossPence
  const ani = Math.max(0, input.totalIncomePence - adjustments)
  return {
    totalIncomePence: input.totalIncomePence,
    allowableAniAdjustmentsPence: adjustments,
    adjustedNetIncomePence: ani,
  }
}

export function calculatePersonalAllowance(aniPence: Pence, rules: TaxYearRules): Pence {
  const aniPounds = Math.floor(aniPence / 100)
  const thresholdPounds = Math.floor(rules.personalAllowanceTaperThresholdPence / 100)
  const paPounds = Math.floor(rules.personalAllowancePence / 100)

  if (aniPounds <= thresholdPounds) {
    return rules.personalAllowancePence
  }

  const reductionPounds = Math.floor((aniPounds - thresholdPounds) / 2)
  return Math.max(0, paPounds - reductionPounds) * 100
}
