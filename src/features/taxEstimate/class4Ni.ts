import type { Pence } from './money'
import { getTaxRoundingPolicy } from './rounding'
import type { TaxYearRules } from './taxYearRules'
import type { Class4Breakdown } from './types'

export function calculateClass4Ni(
  selfEmploymentProfitPence: Pence,
  rules: TaxYearRules,
): Class4Breakdown {
  const rounding = getTaxRoundingPolicy()
  const profit = Math.max(0, selfEmploymentProfitPence)

  if (profit <= rules.class4LowerProfitsLimitPence) {
    return {
      profitPence: profit,
      profitWithinMainBandPence: 0,
      profitAboveUpperLimitPence: 0,
      mainClass4Pence: 0,
      additionalClass4Pence: 0,
      totalClass4Pence: 0,
    }
  }

  const profitWithinMainBandPence =
    Math.min(profit, rules.class4UpperProfitsLimitPence) -
    rules.class4LowerProfitsLimitPence
  const profitAboveUpperLimitPence = Math.max(
    0,
    profit - rules.class4UpperProfitsLimitPence,
  )
  const mainClass4Pence = rounding.applyRate(
    profitWithinMainBandPence,
    rules.class4MainRate,
  )
  const additionalClass4Pence = rounding.applyRate(
    profitAboveUpperLimitPence,
    rules.class4AdditionalRate,
  )

  return {
    profitPence: profit,
    profitWithinMainBandPence,
    profitAboveUpperLimitPence,
    mainClass4Pence,
    additionalClass4Pence,
    totalClass4Pence: mainClass4Pence + additionalClass4Pence,
  }
}
