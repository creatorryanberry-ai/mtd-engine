import type { Pence } from './money'
import type { StudentLoanPlanId, TaxJurisdiction } from './taxYearRules'

export type CategoryAnswerStatus =
  | 'not_answered'
  | 'no'
  | 'complete'
  | 'incomplete'
  | 'needs_review'

export type YesNoNotSure = 'yes' | 'no' | 'not_sure'

export type EstimateCategoryId =
  | 'employment'
  | 'savings'
  | 'investments'
  | 'property'
  | 'pensions'
  | 'family'
  | 'studentLoan'
  | 'reliefs'
  | 'capitalGains'
  | 'foreignIncome'
  | 'otherIncome'

export type TaxEstimateEmploymentRecord = {
  id: string
  employerName: string
  grossPayPounds: number | null
  payeTaxDeductedPounds: number | null
  taxableBenefitsPounds: number | null
}

export type TaxEstimateEmploymentAnswers = {
  status: CategoryAnswerStatus
  hadJob: YesNoNotSure | null
  jobs: TaxEstimateEmploymentRecord[]
  taxableBenefits: YesNoNotSure | null
}

export type TaxEstimateSavingsAnswers = {
  status: CategoryAnswerStatus
  hadInterest: YesNoNotSure | null
  ukInterestPounds: number | null
  foreignInterestPounds: number | null
}

export type TaxEstimateInvestmentAnswers = {
  status: CategoryAnswerStatus
  hadDividends: YesNoNotSure | null
  ukDividendsPounds: number | null
  foreignDividendsPounds: number | null
  soldInvestments: YesNoNotSure | null
}

export type TaxEstimatePropertyAnswers = {
  status: CategoryAnswerStatus
  hadRental: YesNoNotSure | null
  ukProperty: boolean
  foreignProperty: boolean
  grossRentalPounds: number | null
  allowableExpensesPounds: number | null
  useExistingRecords: boolean
}

export type PensionKind = 'state' | 'private' | 'workplace' | 'annuity'

export type TaxEstimatePensionAnswers = {
  status: CategoryAnswerStatus
  hadPension: YesNoNotSure | null
  kinds: PensionKind[]
  totalPounds: number | null
  taxDeductedPounds: number | null
}

export type TaxEstimateChildBenefitAnswers = {
  status: CategoryAnswerStatus
  received: YesNoNotSure | null
  who: 'you' | 'partner' | 'both' | null
  numberOfChildren: number | null
  amountReceivedPounds: number | null
  amountOverridden: boolean
}

export type TaxEstimateStudentLoanAnswers = {
  status: CategoryAnswerStatus
  repaying: YesNoNotSure | null
  undergraduatePlan: Exclude<StudentLoanPlanId, 'postgraduate'> | null
  postgraduate: boolean
}

export type TaxEstimateReliefsAnswers = {
  status: CategoryAnswerStatus
  hadReliefs: YesNoNotSure | null
  pensionContributions: YesNoNotSure | null
  pensionContributionIsNet: boolean
  pensionContributionPounds: number | null
  giftAid: YesNoNotSure | null
  giftAidPounds: number | null
}

export type CapitalGainsAssetType =
  | 'property'
  | 'shares'
  | 'crypto'
  | 'business'
  | 'other'

export type CgtResultStatus =
  | 'exact_enough_for_estimate'
  | 'needs_more_information'
  | 'specialist_calculation_recommended'

export type TaxEstimateCapitalGainsAnswers = {
  status: CategoryAnswerStatus
  soldAssets: YesNoNotSure | null
  types: CapitalGainsAssetType[]
  proceedsPounds: number | null
  costPounds: number | null
  incidentalCostsPounds: number | null
  improvementCostsPounds: number | null
  lossesAvailablePounds: number | null
}

export type ForeignIncomeCategory =
  | 'employment'
  | 'property'
  | 'savings'
  | 'dividends'
  | 'pension'
  | 'other'

export type TaxEstimateForeignIncomeAnswers = {
  status: CategoryAnswerStatus
  hadForeignIncome: YesNoNotSure | null
  category: ForeignIncomeCategory | null
  amountPounds: number | null
  foreignTaxPaidPounds: number | null
}

export type TaxEstimateOtherIncomeAnswers = {
  status: CategoryAnswerStatus
  hadOtherIncome: YesNoNotSure | null
  description: string
  amountPounds: number | null
  taxDeductedPounds: number | null
}

export type TaxEstimateAnswers = {
  employment: TaxEstimateEmploymentAnswers
  savings: TaxEstimateSavingsAnswers
  investments: TaxEstimateInvestmentAnswers
  property: TaxEstimatePropertyAnswers
  pensions: TaxEstimatePensionAnswers
  family: TaxEstimateChildBenefitAnswers
  studentLoan: TaxEstimateStudentLoanAnswers
  reliefs: TaxEstimateReliefsAnswers
  capitalGains: TaxEstimateCapitalGainsAnswers
  foreignIncome: TaxEstimateForeignIncomeAnswers
  otherIncome: TaxEstimateOtherIncomeAnswers
}

export type BusinessProfitSnapshot = {
  selfEmploymentRecordedProfitPounds: number
  selfEmploymentProjectedProfitPounds: number | null
  selfEmploymentTurnoverPounds: number
  selfEmploymentExpensesPounds: number
  yearComplete: boolean
  daysElapsed: number
  daysInYear: number
  usingProjection: boolean
  profitUsedPounds: number
  propertyGrossPounds: number
  propertyExpensesPounds: number
  propertyProfitPounds: number
  propertyFromRecords: boolean
  cisDeductedPounds: number
  cisIncomplete: boolean
}

export type TaxableBusinessProfit = BusinessProfitSnapshot

export type TaxEstimateRequest = {
  taxYearStart: string
  jurisdiction: TaxJurisdiction
  answers: TaxEstimateAnswers
  business: TaxableBusinessProfit
  useProjection: boolean
}

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type BandTaxSlice = {
  bandId: string
  label: string
  amountPence: Pence
  rate: number
  taxPence: Pence
}

export type Class4Breakdown = {
  profitPence: Pence
  profitWithinMainBandPence: Pence
  profitAboveUpperLimitPence: Pence
  mainClass4Pence: Pence
  additionalClass4Pence: Pence
  totalClass4Pence: Pence
}

export type PaymentsOnAccountEstimate = {
  required: boolean
  estimated: boolean
  relevantAmountPence: Pence
  firstPaymentPence: Pence
  secondPaymentPence: Pence
  januaryTotalPence: Pence
  julyPaymentPence: Pence
}

export type TaxEstimateTrace = Record<string, number | string | boolean | null>

export type TaxEstimateResult = {
  taxYearStart: string
  taxYearLabel: string
  jurisdiction: TaxJurisdiction
  supported: boolean
  unsupportedReason: string | null
  incomeTaxPence: Pence
  nonSavingsTaxPence: Pence
  savingsTaxPence: Pence
  dividendTaxPence: Pence
  class4NiPence: Pence
  class4: Class4Breakdown
  class2InformationalPence: Pence
  studentLoanPence: Pence
  childBenefitChargePence: Pence
  capitalGainsTaxPence: Pence
  cgtStatus: CgtResultStatus | null
  totalLiabilityPence: Pence
  payeDeductedPence: Pence
  pensionTaxDeductedPence: Pence
  cisDeductedPence: Pence
  otherTaxDeductedPence: Pence
  alreadyPaidPence: Pence
  stillToPayPence: Pence
  paymentsOnAccount: PaymentsOnAccountEstimate
  totalIncomePence: Pence
  nonSavingsIncomePence: Pence
  savingsIncomePence: Pence
  dividendIncomePence: Pence
  selfEmploymentProfitPence: Pence
  employmentIncomePence: Pence
  propertyProfitPence: Pence
  pensionIncomePence: Pence
  otherIncomePence: Pence
  personalAllowancePence: Pence
  taxableIncomePence: Pence
  adjustedNetIncomePence: Pence
  allowableAniAdjustmentsPence: Pence
  nonSavingsSlices: BandTaxSlice[]
  savingsSlices: BandTaxSlice[]
  dividendSlices: BandTaxSlice[]
  projectionUsed: boolean
  projectedProfitPence: Pence | null
  recordedProfitPence: Pence
  foreignIncomeNeedsReview: boolean
  confidence: ConfidenceLevel
  completionPercent: number
  confidenceMessage: string
  categoryStatuses: Record<EstimateCategoryId, CategoryAnswerStatus>
  trace: TaxEstimateTrace
}

export type TaxEstimatePoundsResult = {
  taxYearStart: string
  taxYearLabel: string
  jurisdiction: TaxJurisdiction
  supported: boolean
  unsupportedReason: string | null
  incomeTax: number
  class4Ni: number
  studentLoan: number
  childBenefitCharge: number
  capitalGainsTax: number
  cgtStatus: CgtResultStatus | null
  cgtNote: string | null
  totalLiability: number
  alreadyPaid: number
  alreadyPaidBreakdown: {
    paye: number
    pension: number
    cis: number
    other: number
  }
  stillToPay: number
  paymentsOnAccount: {
    required: boolean
    estimated: boolean
    firstPayment: number
    secondPayment: number
    januaryTotal: number
    julyPayment: number
  }
  breakdown: {
    businessProfit: number
    recordedBusinessProfit: number
    projectedBusinessProfit: number | null
    projectionUsed: boolean
    projectionNote: string | null
    employmentIncome: number
    savingsInterest: number
    dividends: number
    propertyProfit: number
    pensionIncome: number
    otherIncome: number
    totalIncome: number
    personalAllowance: number
    taxableIncome: number
    adjustedNetIncome: number
    class4: {
      profit: number
      profitWithinMainBand: number
      profitAboveUpperLimit: number
      mainClass4: number
      additionalClass4: number
      total: number
    }
    nonSavingsSlices: Array<{
      label: string
      amount: number
      rate: number
      tax: number
    }>
    savingsSlices: Array<{
      label: string
      amount: number
      rate: number
      tax: number
    }>
    dividendSlices: Array<{
      label: string
      amount: number
      rate: number
      tax: number
    }>
  }
  confidence: {
    level: ConfidenceLevel
    completionPercent: number
    message: string
  }
  categoryStatuses: Record<EstimateCategoryId, CategoryAnswerStatus>
  class2Note: string | null
  foreignIncomeNeedsReview: boolean
  disclaimer: string
  trace: TaxEstimateTrace
}
