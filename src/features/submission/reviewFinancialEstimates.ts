export type ReviewCisVoucherSummary = {
  id: string
  customer: string
  gross: number
  tax: number
}

export type ReviewManualEntrySummary = {
  id: string
  label: string
  amount: number
}

export type ReviewPrivateUseItem = {
  label: string
  percent: number
}

export type ReviewMileageSummary = {
  milesThisQuarter: number
  claimPoundsThisQuarter: number
}

export type ReviewPeriodTransaction = {
  id: string
  label: string
  accountLabel: string
  amount: number
}

export type ReviewFinancialSummary = {
  income: number
  expenses: number
  profit: number
  /** local fallback: 15% of profit (same as homepage when HMRC unavailable) */
  estimatedTax: number
  /** local fallback: Class 4 NI estimate when HMRC unavailable */
  estimatedNationalInsurance: number
  cisTaxPaid: number
  showCisTax: boolean
  showCisStep: boolean
  showMileageStep: boolean
  cisVouchers: ReviewCisVoucherSummary[]
  /** accepted income transactions for the review period (all accounts) */
  incomeTransactions: ReviewPeriodTransaction[]
  /** accepted expense transactions for the review period (all accounts) */
  expenseTransactions: ReviewPeriodTransaction[]
  /** mileage recorder entries for the current quarter (claim £ as amount) */
  mileageTransactions: ReviewPeriodTransaction[]
  privateUseItems: ReviewPrivateUseItem[]
  mileage: ReviewMileageSummary | null
  quarterLabel: string
  taxYearLabel: string
}

/** matches homepage / submission mock when HMRC estimate is unavailable */
export const MOCK_TAX_RATE = 0.15

// simplified 2025/26 Class 4 self-employed NI for display
const CLASS4_LOWER = 12_570
const CLASS4_UPPER = 50_270
const CLASS4_MAIN_RATE = 0.06
const CLASS4_HIGHER_RATE = 0.02

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function estimateTaxDue(profit: number) {
  if (profit <= 0) return 0
  return roundMoney(profit * MOCK_TAX_RATE)
}

export function estimateClass4NationalInsurance(profit: number) {
  if (profit <= CLASS4_LOWER) return 0

  const mainBand = Math.min(profit, CLASS4_UPPER) - CLASS4_LOWER
  const higherBand = Math.max(0, profit - CLASS4_UPPER)

  return roundMoney(mainBand * CLASS4_MAIN_RATE + higherBand * CLASS4_HIGHER_RATE)
}
