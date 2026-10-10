import type { TaxJurisdiction, TaxYearRules } from '../taxYearRules'

const P = (pounds: number) => Math.round(pounds * 100)

function ewniBands(): TaxYearRules['nonSavingsBands'] {
  return [
    { id: 'basic', label: 'Basic rate', toPence: P(50_270), rate: 0.2 },
    { id: 'higher', label: 'Higher rate', toPence: P(125_140), rate: 0.4 },
    { id: 'additional', label: 'Additional rate', toPence: null, rate: 0.45 },
  ]
}

function ukSavingsDividendBands(): TaxYearRules['ukSavingsDividendBands'] {
  return [
    { id: 'basic', label: 'Basic rate', toPence: P(50_270), rate: 0.2 },
    { id: 'higher', label: 'Higher rate', toPence: P(125_140), rate: 0.4 },
    { id: 'additional', label: 'Additional rate', toPence: null, rate: 0.45 },
  ]
}

function studentLoan2025_26(): TaxYearRules['studentLoan'] {
  return {
    plan1: { thresholdPence: P(26_065), rate: 0.09 },
    plan2: { thresholdPence: P(28_470), rate: 0.09 },
    plan4: { thresholdPence: P(32_745), rate: 0.09 },
    plan5: { thresholdPence: P(25_000), rate: 0.09 },
    postgraduate: { thresholdPence: P(21_000), rate: 0.06 },
  }
}

function studentLoan2026_27(): TaxYearRules['studentLoan'] {
  return {
    plan1: { thresholdPence: P(26_900), rate: 0.09 },
    plan2: { thresholdPence: P(29_385), rate: 0.09 },
    plan4: { thresholdPence: P(33_795), rate: 0.09 },
    plan5: { thresholdPence: P(25_000), rate: 0.09 },
    postgraduate: { thresholdPence: P(21_000), rate: 0.06 },
  }
}

function shared(
  taxYearStart: string,
  taxYearLabel: string,
  jurisdiction: TaxJurisdiction,
  studentLoan: TaxYearRules['studentLoan'],
  dividendRates: { basic: number; higher: number; additional: number },
  nonSavingsBands: TaxYearRules['nonSavingsBands'],
): TaxYearRules {
  return {
    taxYearStart,
    taxYearLabel,
    jurisdiction,
    personalAllowancePence: P(12_570),
    personalAllowanceTaperThresholdPence: P(100_000),
    additionalRateThresholdPence: P(125_140),
    nonSavingsBands,
    ukSavingsDividendBands: ukSavingsDividendBands(),
    startingRateForSavingsPence: P(5_000),
    startingRateForSavingsRate: 0,
    personalSavingsAllowanceBasicPence: P(1_000),
    personalSavingsAllowanceHigherPence: P(500),
    personalSavingsAllowanceAdditionalPence: 0,
    dividendAllowancePence: P(500),
    dividendBasicRate: dividendRates.basic,
    dividendHigherRate: dividendRates.higher,
    dividendAdditionalRate: dividendRates.additional,
    class4LowerProfitsLimitPence: P(12_570),
    class4UpperProfitsLimitPence: P(50_270),
    class4MainRate: 0.06,
    class4AdditionalRate: 0.02,
    class2VoluntaryWeeklyPence: 365,
    class2SmallProfitsThresholdPence: P(6_845),
    studentLoan,
    childBenefitFirstChildWeeklyPence: 2605,
    childBenefitAdditionalChildWeeklyPence: 1725,
    childBenefitWeeks: 52,
    hicbcThresholdPence: P(60_000),
    hicbcFullChargePence: P(80_000),
    hicbcStepPounds: 200,
    cgtAnnualExemptPence: P(3_000),
    cgtBasicRate: 0.18,
    cgtHigherRate: 0.24,
    paymentsOnAccountMinimumPence: P(1_000),
    paymentsOnAccountCollectedAtSourceRatio: 0.8,
  }
}

export function createEnglandWalesNiRules(
  taxYearStart: string,
  taxYearLabel: string,
  studentLoan: TaxYearRules['studentLoan'],
  dividendRates: { basic: number; higher: number; additional: number },
): TaxYearRules {
  return shared(
    taxYearStart,
    taxYearLabel,
    'england',
    studentLoan,
    dividendRates,
    ewniBands(),
  )
}

function scottishBands2025_26(): TaxYearRules['nonSavingsBands'] {
  return [
    { id: 'starter', label: 'Starter rate', toPence: P(15_397), rate: 0.19 },
    { id: 'basic', label: 'Basic rate', toPence: P(27_491), rate: 0.2 },
    { id: 'intermediate', label: 'Intermediate rate', toPence: P(43_662), rate: 0.21 },
    { id: 'higher', label: 'Higher rate', toPence: P(75_000), rate: 0.42 },
    { id: 'advanced', label: 'Advanced rate', toPence: P(125_140), rate: 0.45 },
    { id: 'top', label: 'Top rate', toPence: null, rate: 0.48 },
  ]
}

function scottishBands2026_27(): TaxYearRules['nonSavingsBands'] {
  return [
    { id: 'starter', label: 'Starter rate', toPence: P(16_537), rate: 0.19 },
    { id: 'basic', label: 'Basic rate', toPence: P(29_526), rate: 0.2 },
    { id: 'intermediate', label: 'Intermediate rate', toPence: P(43_662), rate: 0.21 },
    { id: 'higher', label: 'Higher rate', toPence: P(75_000), rate: 0.42 },
    { id: 'advanced', label: 'Advanced rate', toPence: P(125_140), rate: 0.45 },
    { id: 'top', label: 'Top rate', toPence: null, rate: 0.48 },
  ]
}

export const taxYear2025_26England = createEnglandWalesNiRules(
  '2025-04-06',
  '2025/26',
  studentLoan2025_26(),
  { basic: 0.0875, higher: 0.3375, additional: 0.3935 },
)

export const taxYear2026_27England = createEnglandWalesNiRules(
  '2026-04-06',
  '2026/27',
  studentLoan2026_27(),
  { basic: 0.1075, higher: 0.3575, additional: 0.3935 },
)

export const taxYear2025_26Scotland: TaxYearRules = {
  ...shared(
    '2025-04-06',
    '2025/26',
    'scotland',
    studentLoan2025_26(),
    { basic: 0.0875, higher: 0.3375, additional: 0.3935 },
    scottishBands2025_26(),
  ),
}

export const taxYear2026_27Scotland: TaxYearRules = {
  ...shared(
    '2026-04-06',
    '2026/27',
    'scotland',
    studentLoan2026_27(),
    { basic: 0.1075, higher: 0.3575, additional: 0.3935 },
    scottishBands2026_27(),
  ),
}

export { studentLoan2025_26, studentLoan2026_27 }
