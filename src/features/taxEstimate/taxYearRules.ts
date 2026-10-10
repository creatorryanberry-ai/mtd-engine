import type { Pence } from './money'

export type TaxJurisdiction = 'england' | 'wales' | 'northern_ireland' | 'scotland'

export type IncomeTaxBand = {
  id: string
  label: string
  /** exclusive upper bound in pence of total income, or null for the top band */
  toPence: Pence | null
  rate: number
}

export type StudentLoanPlanId = 'plan1' | 'plan2' | 'plan4' | 'plan5' | 'postgraduate'

export type TaxYearRules = {
  taxYearStart: string
  taxYearLabel: string
  jurisdiction: TaxJurisdiction
  personalAllowancePence: Pence
  personalAllowanceTaperThresholdPence: Pence
  additionalRateThresholdPence: Pence
  /** England/Wales/NI: non-savings bands measured from total income including PA */
  nonSavingsBands: IncomeTaxBand[]
  /** UK-wide savings/dividend band structure measured from total income including PA */
  ukSavingsDividendBands: IncomeTaxBand[]
  startingRateForSavingsPence: Pence
  startingRateForSavingsRate: number
  personalSavingsAllowanceBasicPence: Pence
  personalSavingsAllowanceHigherPence: Pence
  personalSavingsAllowanceAdditionalPence: Pence
  dividendAllowancePence: Pence
  dividendBasicRate: number
  dividendHigherRate: number
  dividendAdditionalRate: number
  class4LowerProfitsLimitPence: Pence
  class4UpperProfitsLimitPence: Pence
  class4MainRate: number
  class4AdditionalRate: number
  class2VoluntaryWeeklyPence: Pence
  class2SmallProfitsThresholdPence: Pence
  studentLoan: Record<
    StudentLoanPlanId,
    {
      thresholdPence: Pence
      rate: number
    }
  >
  childBenefitFirstChildWeeklyPence: Pence
  childBenefitAdditionalChildWeeklyPence: Pence
  childBenefitWeeks: number
  hicbcThresholdPence: Pence
  hicbcFullChargePence: Pence
  /** 1% of benefit for every this many pounds of ANI above the threshold */
  hicbcStepPounds: number
  cgtAnnualExemptPence: Pence
  cgtBasicRate: number
  cgtHigherRate: number
  paymentsOnAccountMinimumPence: Pence
  paymentsOnAccountCollectedAtSourceRatio: number
}
