import {
  calculateAdjustedNetIncome,
  calculatePersonalAllowance,
  giftAidGrossPence,
  pensionGrossPence,
} from './adjustedNetIncome'
import { deriveCategoryStatuses } from './answers'
import { calculateCapitalGainsEstimate } from './capitalGains'
import {
  calculateHighIncomeChildBenefitCharge,
  defaultChildBenefitPence,
} from './childBenefit'
import { calculateClass4Ni } from './class4Ni'
import { scoreTaxEstimateConfidence } from './confidence'
import { calculateIncomeTaxStack, collectIncome } from './income'
import { poundsToPence, penceToPounds } from './money'
import { calculatePaymentsOnAccount } from './paymentsOnAccount'
import { getTaxYearRules } from './rules'
import { calculateStudentLoanRepayment } from './studentLoan'
import type { TaxJurisdiction } from './taxYearRules'
import type {
  TaxEstimateAnswers,
  TaxEstimatePoundsResult,
  TaxEstimateRequest,
  TaxEstimateResult,
  TaxableBusinessProfit,
} from './types'

export type TaxEstimator = {
  estimate(request: TaxEstimateRequest): TaxEstimateResult
}

export function createTaxEstimator(): TaxEstimator {
  return { estimate }
}

export function estimateTax(request: TaxEstimateRequest): TaxEstimateResult {
  return estimate(request)
}

function estimate(request: TaxEstimateRequest): TaxEstimateResult {
  const rules = getTaxYearRules(request.taxYearStart, request.jurisdiction)
  const income = collectIncome({
    answers: request.answers,
    business: request.business,
  })
  const giftAidGross = giftAidGrossPence(request.answers)
  const pensionGross = pensionGrossPence(request.answers)
  const ani = calculateAdjustedNetIncome({
    totalIncomePence: income.total,
    giftAidGrossPence: giftAidGross,
    pensionGrossPence: pensionGross,
  })
  const personalAllowance = calculatePersonalAllowance(ani.adjustedNetIncomePence, rules)
  const bandExtension = giftAidGross + pensionGross

  const stack = calculateIncomeTaxStack({
    nonSavingsPence: income.nonSavings,
    savingsPence: income.savings,
    dividendsPence: income.dividends,
    personalAllowancePence: personalAllowance,
    bandExtensionPence: bandExtension,
    rules,
  })

  const class4 = calculateClass4Ni(income.selfEmployment, rules)
  const class2InformationalPence =
    income.selfEmployment > 0 &&
    income.selfEmployment < rules.class2SmallProfitsThresholdPence
      ? rules.class2VoluntaryWeeklyPence * 52
      : 0

  const studentLoanIncome = Math.max(0, ani.adjustedNetIncomePence)
  const studentLoan =
    request.answers.studentLoan.repaying === 'yes'
      ? calculateStudentLoanRepayment({
          incomePence: studentLoanIncome,
          undergraduatePlan: request.answers.studentLoan.undergraduatePlan,
          postgraduate: request.answers.studentLoan.postgraduate,
          rules,
        })
      : { undergraduatePence: 0, postgraduatePence: 0, totalPence: 0 }

  const children = request.answers.family.numberOfChildren ?? 0
  const childBenefit =
    request.answers.family.amountOverridden &&
    request.answers.family.amountReceivedPounds != null
      ? poundsToPence(request.answers.family.amountReceivedPounds)
      : defaultChildBenefitPence(children, rules)
  const hicbc = calculateHighIncomeChildBenefitCharge({
    adjustedNetIncomePence: ani.adjustedNetIncomePence,
    childBenefitPence: childBenefit,
    receivedByUser:
      request.answers.family.received === 'yes' &&
      request.answers.family.who !== 'partner',
    rules,
  })

  const cgt = calculateCapitalGainsEstimate({
    answers: request.answers.capitalGains,
    remainingBasicRateRoomPence: stack.remainingBasicRateRoomPence,
    rules,
  })
  const cgtTax = cgt.status === 'exact_enough_for_estimate' ? cgt.taxPence : 0

  const alreadyPaid = Math.min(
    income.paye +
      income.pensionTaxDeducted +
      income.cisDeducted +
      income.otherTaxDeducted,
    Number.MAX_SAFE_INTEGER,
  )

  const totalLiability =
    stack.incomeTaxPence +
    class4.totalClass4Pence +
    studentLoan.totalPence +
    hicbc +
    cgtTax

  const stillToPay = totalLiability - alreadyPaid

  const poa = calculatePaymentsOnAccount({
    incomeTaxPence: stack.incomeTaxPence,
    class4Pence: class4.totalClass4Pence,
    childBenefitChargePence: hicbc,
    alreadyPaidForPoaPence: income.paye + income.pensionTaxDeducted + income.cisDeducted,
    stillToPayPence: stillToPay,
    rules,
    estimated: !request.business.yearComplete,
  })

  const categoryStatuses = deriveCategoryStatuses(request.answers)
  const payeUnknown =
    request.answers.employment.hadJob === 'yes' &&
    request.answers.employment.jobs.some(
      (job) => (job.grossPayPounds ?? 0) > 0 && job.payeTaxDeductedPounds == null,
    )
  const foreignNeedsReview =
    request.answers.foreignIncome.hadForeignIncome === 'yes' &&
    (request.answers.foreignIncome.foreignTaxPaidPounds ?? 0) > 0
  const confidence = scoreTaxEstimateConfidence({
    categoryStatuses,
    business: request.business,
    cgtNeedsMore:
      cgt.status !== 'exact_enough_for_estimate' &&
      cgt.status != null &&
      request.answers.capitalGains.soldAssets === 'yes',
    foreignNeedsReview,
    payeUnknown,
  })

  const recordedProfitPence = poundsToPence(
    request.business.selfEmploymentRecordedProfitPounds,
  )
  const projectedProfitPence =
    request.business.selfEmploymentProjectedProfitPounds == null
      ? null
      : poundsToPence(request.business.selfEmploymentProjectedProfitPounds)

  return {
    taxYearStart: rules.taxYearStart,
    taxYearLabel: rules.taxYearLabel,
    jurisdiction: request.jurisdiction,
    supported: true,
    unsupportedReason: null,
    incomeTaxPence: stack.incomeTaxPence,
    nonSavingsTaxPence: stack.nonSavingsTaxPence,
    savingsTaxPence: stack.savingsTaxPence,
    dividendTaxPence: stack.dividendTaxPence,
    class4NiPence: class4.totalClass4Pence,
    class4,
    class2InformationalPence,
    studentLoanPence: studentLoan.totalPence,
    childBenefitChargePence: hicbc,
    capitalGainsTaxPence: cgtTax,
    cgtStatus: request.answers.capitalGains.soldAssets === 'yes' ? cgt.status : null,
    totalLiabilityPence: totalLiability,
    payeDeductedPence: income.paye,
    pensionTaxDeductedPence: income.pensionTaxDeducted,
    cisDeductedPence: income.cisDeducted,
    otherTaxDeductedPence: income.otherTaxDeducted,
    alreadyPaidPence: alreadyPaid,
    stillToPayPence: stillToPay,
    paymentsOnAccount: poa,
    totalIncomePence: income.total,
    nonSavingsIncomePence: income.nonSavings,
    savingsIncomePence: income.savings,
    dividendIncomePence: income.dividends,
    selfEmploymentProfitPence: income.selfEmployment,
    employmentIncomePence: income.employment + income.benefits,
    propertyProfitPence: income.propertyProfit,
    pensionIncomePence: income.pension,
    otherIncomePence: income.other,
    personalAllowancePence: personalAllowance,
    taxableIncomePence: stack.taxableIncomePence,
    adjustedNetIncomePence: ani.adjustedNetIncomePence,
    allowableAniAdjustmentsPence: ani.allowableAniAdjustmentsPence,
    nonSavingsSlices: stack.nonSavingsSlices,
    savingsSlices: stack.savingsSlices,
    dividendSlices: stack.dividendSlices,
    projectionUsed:
      request.useProjection &&
      !request.business.yearComplete &&
      projectedProfitPence != null,
    projectedProfitPence,
    recordedProfitPence,
    foreignIncomeNeedsReview: foreignNeedsReview,
    confidence: confidence.level,
    completionPercent: confidence.completionPercent,
    confidenceMessage: confidence.message,
    categoryStatuses,
    trace: {
      PersonalAllowance: personalAllowance / 100,
      TaxableNonSavingsIncome: stack.taxableNonSavingsPence / 100,
      TaxableSavingsIncome: stack.taxableSavingsPence / 100,
      TaxableDividendIncome: stack.taxableDividendsPence / 100,
      BasicRateIncome:
        stack.nonSavingsSlices.find((slice) => slice.bandId === 'basic')?.amountPence ??
        0,
      BasicRateTax:
        (stack.nonSavingsSlices.find((slice) => slice.bandId === 'basic')?.taxPence ??
          0) / 100,
      Class4MainBandProfit: class4.profitWithinMainBandPence / 100,
      Class4Main: class4.mainClass4Pence / 100,
      Class4Additional: class4.additionalClass4Pence / 100,
      AdjustedNetIncome: ani.adjustedNetIncomePence / 100,
      GiftAidGross: giftAidGross / 100,
      PensionGross: pensionGross / 100,
      StartingRateUsed: stack.startingRateUsedPence / 100,
      PersonalSavingsAllowance: stack.personalSavingsAllowancePence / 100,
      DividendAllowance:
        Math.min(stack.taxableDividendsPence, rules.dividendAllowancePence) / 100,
      CisDeducted: income.cisDeducted / 100,
      PayeDeducted: income.paye / 100,
    },
  }
}

export function toTaxEstimatePoundsResult(
  result: TaxEstimateResult,
): TaxEstimatePoundsResult {
  const p = penceToPounds
  const slice = (items: TaxEstimateResult['nonSavingsSlices']) =>
    items.map((item) => ({
      label: item.label,
      amount: p(item.amountPence),
      rate: item.rate,
      tax: p(item.taxPence),
    }))

  const cgtNote =
    result.cgtStatus === 'needs_more_information' ||
    result.cgtStatus === 'specialist_calculation_recommended'
      ? 'Capital Gains may affect this estimate.'
      : null

  const projectionNote = result.projectionUsed
    ? `Based on your activity so far, we're projecting a full-year profit of £${p(result.projectedProfitPence ?? 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}.`
    : null

  return {
    taxYearStart: result.taxYearStart,
    taxYearLabel: result.taxYearLabel,
    jurisdiction: result.jurisdiction,
    supported: result.supported,
    unsupportedReason: result.unsupportedReason,
    incomeTax: p(result.incomeTaxPence),
    class4Ni: p(result.class4NiPence),
    studentLoan: p(result.studentLoanPence),
    childBenefitCharge: p(result.childBenefitChargePence),
    capitalGainsTax: p(result.capitalGainsTaxPence),
    cgtStatus: result.cgtStatus,
    cgtNote,
    totalLiability: p(result.totalLiabilityPence),
    alreadyPaid: p(result.alreadyPaidPence),
    alreadyPaidBreakdown: {
      paye: p(result.payeDeductedPence),
      pension: p(result.pensionTaxDeductedPence),
      cis: p(result.cisDeductedPence),
      other: p(result.otherTaxDeductedPence),
    },
    stillToPay: p(result.stillToPayPence),
    paymentsOnAccount: {
      required: result.paymentsOnAccount.required,
      estimated: result.paymentsOnAccount.estimated,
      firstPayment: p(result.paymentsOnAccount.firstPaymentPence),
      secondPayment: p(result.paymentsOnAccount.secondPaymentPence),
      januaryTotal: p(result.paymentsOnAccount.januaryTotalPence),
      julyPayment: p(result.paymentsOnAccount.julyPaymentPence),
    },
    breakdown: {
      businessProfit: p(result.selfEmploymentProfitPence),
      recordedBusinessProfit: p(result.recordedProfitPence),
      projectedBusinessProfit:
        result.projectedProfitPence == null ? null : p(result.projectedProfitPence),
      projectionUsed: result.projectionUsed,
      projectionNote,
      employmentIncome: p(result.employmentIncomePence),
      savingsInterest: p(result.savingsIncomePence),
      dividends: p(result.dividendIncomePence),
      propertyProfit: p(result.propertyProfitPence),
      pensionIncome: p(result.pensionIncomePence),
      otherIncome: p(result.otherIncomePence),
      totalIncome: p(result.totalIncomePence),
      personalAllowance: p(result.personalAllowancePence),
      taxableIncome: p(result.taxableIncomePence),
      adjustedNetIncome: p(result.adjustedNetIncomePence),
      class4: {
        profit: p(result.class4.profitPence),
        profitWithinMainBand: p(result.class4.profitWithinMainBandPence),
        profitAboveUpperLimit: p(result.class4.profitAboveUpperLimitPence),
        mainClass4: p(result.class4.mainClass4Pence),
        additionalClass4: p(result.class4.additionalClass4Pence),
        total: p(result.class4.totalClass4Pence),
      },
      nonSavingsSlices: slice(result.nonSavingsSlices),
      savingsSlices: slice(result.savingsSlices),
      dividendSlices: slice(result.dividendSlices),
    },
    confidence: {
      level: result.confidence,
      completionPercent: result.completionPercent,
      message: result.confidenceMessage,
    },
    categoryStatuses: result.categoryStatuses,
    class2Note:
      result.class2InformationalPence > 0
        ? 'You may be able to pay voluntary Class 2 National Insurance to protect your State Pension record. We have not added this to your estimate.'
        : null,
    foreignIncomeNeedsReview: result.foreignIncomeNeedsReview,
    disclaimer:
      "This is an estimate based on the information you've given us. Your final tax bill may change when your full tax return is completed.",
    trace: result.trace,
  }
}

export function emptyBusinessProfit(): TaxableBusinessProfit {
  return {
    selfEmploymentRecordedProfitPounds: 0,
    selfEmploymentProjectedProfitPounds: null,
    selfEmploymentTurnoverPounds: 0,
    selfEmploymentExpensesPounds: 0,
    yearComplete: true,
    daysElapsed: 365,
    daysInYear: 365,
    usingProjection: false,
    profitUsedPounds: 0,
    propertyGrossPounds: 0,
    propertyExpensesPounds: 0,
    propertyProfitPounds: 0,
    propertyFromRecords: false,
    cisDeductedPounds: 0,
    cisIncomplete: false,
  }
}

export function estimateForAnswers(input: {
  taxYearStart: string
  jurisdiction?: TaxJurisdiction
  answers: TaxEstimateAnswers
  business?: TaxableBusinessProfit
  useProjection?: boolean
}): TaxEstimatePoundsResult {
  const result = estimate({
    taxYearStart: input.taxYearStart,
    jurisdiction: input.jurisdiction ?? 'england',
    answers: input.answers,
    business: input.business ?? emptyBusinessProfit(),
    useProjection: input.useProjection ?? false,
  })
  return toTaxEstimatePoundsResult(result)
}
