import { emptyBusinessProfit } from './taxEstimator'

export {
  emptyTaxEstimateAnswers,
  createEmploymentRecord,
  deriveCategoryStatuses,
} from './answers'
export {
  calculateAdjustedNetIncome,
  calculatePersonalAllowance,
  grossUpReliefAtSource,
} from './adjustedNetIncome'
export { calculateClass4Ni } from './class4Ni'
export { calculateStudentLoanRepayment } from './studentLoan'
export {
  calculateHighIncomeChildBenefitCharge,
  defaultChildBenefitPence,
} from './childBenefit'
export { calculateCapitalGainsEstimate } from './capitalGains'
export { calculatePaymentsOnAccount } from './paymentsOnAccount'
export { getTaxYearRules, defaultTaxYearRulesProvider } from './rules'
export {
  estimateTax,
  createTaxEstimator,
  estimateForAnswers,
  toTaxEstimatePoundsResult,
  emptyBusinessProfit,
} from './taxEstimator'
export { poundsToPence, penceToPounds } from './money'
export { getTaxRoundingPolicy } from './rounding'
export { ESTIMATE_CATEGORIES } from './categories'

export type { TaxYearRules, TaxJurisdiction, StudentLoanPlanId } from './taxYearRules'
export type { TaxYearRulesProvider } from './rules'
export type {
  TaxEstimateRequest,
  TaxEstimateResult,
  TaxEstimatePoundsResult,
  TaxEstimateAnswers,
  TaxableBusinessProfit,
  EstimateCategoryId,
  CategoryAnswerStatus,
  ConfidenceLevel,
} from './types'

export function businessProfitOnly(profitPounds: number) {
  return {
    ...emptyBusinessProfit(),
    selfEmploymentRecordedProfitPounds: profitPounds,
    profitUsedPounds: profitPounds,
  }
}
