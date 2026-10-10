import type {
  CategoryAnswerStatus,
  EstimateCategoryId,
  TaxEstimateAnswers,
  TaxEstimateEmploymentRecord,
} from './types'

export function createEmploymentRecord(
  overrides?: Partial<TaxEstimateEmploymentRecord>,
): TaxEstimateEmploymentRecord {
  return {
    id: overrides?.id ?? `job-${Date.now()}`,
    employerName: overrides?.employerName ?? '',
    grossPayPounds: overrides?.grossPayPounds ?? null,
    payeTaxDeductedPounds: overrides?.payeTaxDeductedPounds ?? null,
    taxableBenefitsPounds: overrides?.taxableBenefitsPounds ?? null,
  }
}

export function emptyTaxEstimateAnswers(): TaxEstimateAnswers {
  return {
    employment: {
      status: 'not_answered',
      hadJob: null,
      jobs: [createEmploymentRecord({ id: 'job-1' })],
      taxableBenefits: null,
    },
    savings: {
      status: 'not_answered',
      hadInterest: null,
      ukInterestPounds: null,
      foreignInterestPounds: null,
    },
    investments: {
      status: 'not_answered',
      hadDividends: null,
      ukDividendsPounds: null,
      foreignDividendsPounds: null,
      soldInvestments: null,
    },
    property: {
      status: 'not_answered',
      hadRental: null,
      ukProperty: true,
      foreignProperty: false,
      grossRentalPounds: null,
      allowableExpensesPounds: null,
      useExistingRecords: false,
    },
    pensions: {
      status: 'not_answered',
      hadPension: null,
      kinds: [],
      totalPounds: null,
      taxDeductedPounds: null,
    },
    family: {
      status: 'not_answered',
      received: null,
      who: null,
      numberOfChildren: null,
      amountReceivedPounds: null,
      amountOverridden: false,
    },
    studentLoan: {
      status: 'not_answered',
      repaying: null,
      undergraduatePlan: null,
      postgraduate: false,
    },
    reliefs: {
      status: 'not_answered',
      hadReliefs: null,
      pensionContributions: null,
      pensionContributionIsNet: true,
      pensionContributionPounds: null,
      giftAid: null,
      giftAidPounds: null,
    },
    capitalGains: {
      status: 'not_answered',
      soldAssets: null,
      types: [],
      proceedsPounds: null,
      costPounds: null,
      incidentalCostsPounds: null,
      improvementCostsPounds: null,
      lossesAvailablePounds: null,
    },
    foreignIncome: {
      status: 'not_answered',
      hadForeignIncome: null,
      category: null,
      amountPounds: null,
      foreignTaxPaidPounds: null,
    },
    otherIncome: {
      status: 'not_answered',
      hadOtherIncome: null,
      description: '',
      amountPounds: null,
      taxDeductedPounds: null,
    },
  }
}

function ynStatus(
  answer: 'yes' | 'no' | 'not_sure' | null,
  completeWhenYes: boolean,
  notSureIsReview = true,
): CategoryAnswerStatus {
  if (answer == null) return 'not_answered'
  if (answer === 'no') return 'no'
  if (answer === 'not_sure') return notSureIsReview ? 'needs_review' : 'incomplete'
  return completeWhenYes ? 'complete' : 'incomplete'
}

export function deriveCategoryStatuses(
  answers: TaxEstimateAnswers,
): Record<EstimateCategoryId, CategoryAnswerStatus> {
  const employmentComplete =
    answers.employment.hadJob === 'no' ||
    (answers.employment.hadJob === 'yes' &&
      answers.employment.jobs.some((job) => (job.grossPayPounds ?? 0) > 0))

  const savingsComplete =
    answers.savings.hadInterest === 'no' ||
    (answers.savings.hadInterest === 'yes' &&
      ((answers.savings.ukInterestPounds ?? 0) > 0 ||
        (answers.savings.foreignInterestPounds ?? 0) > 0 ||
        answers.savings.ukInterestPounds === 0))

  const investmentsComplete =
    answers.investments.hadDividends === 'no' ||
    (answers.investments.hadDividends === 'yes' &&
      answers.investments.ukDividendsPounds != null &&
      answers.investments.soldInvestments != null)

  const propertyComplete =
    answers.property.hadRental === 'no' ||
    (answers.property.hadRental === 'yes' &&
      (answers.property.useExistingRecords || answers.property.grossRentalPounds != null))

  const pensionsComplete =
    answers.pensions.hadPension === 'no' ||
    (answers.pensions.hadPension === 'yes' && answers.pensions.totalPounds != null)

  const familyComplete =
    answers.family.received === 'no' ||
    (answers.family.received === 'yes' && (answers.family.numberOfChildren ?? 0) > 0)

  const studentComplete =
    answers.studentLoan.repaying === 'no' ||
    (answers.studentLoan.repaying === 'yes' &&
      (answers.studentLoan.undergraduatePlan != null || answers.studentLoan.postgraduate))

  const reliefsComplete =
    answers.reliefs.hadReliefs === 'no' ||
    (answers.reliefs.hadReliefs === 'yes' &&
      answers.reliefs.pensionContributions != null &&
      answers.reliefs.giftAid != null)

  const cgtComplete =
    answers.capitalGains.soldAssets === 'no' ||
    (answers.capitalGains.soldAssets === 'yes' &&
      answers.capitalGains.types.length > 0 &&
      answers.capitalGains.proceedsPounds != null &&
      answers.capitalGains.costPounds != null)

  const foreignComplete =
    answers.foreignIncome.hadForeignIncome === 'no' ||
    (answers.foreignIncome.hadForeignIncome === 'yes' &&
      answers.foreignIncome.amountPounds != null &&
      (answers.foreignIncome.foreignTaxPaidPounds == null ||
        answers.foreignIncome.foreignTaxPaidPounds === 0))

  const otherComplete =
    answers.otherIncome.hadOtherIncome === 'no' ||
    (answers.otherIncome.hadOtherIncome === 'yes' &&
      answers.otherIncome.amountPounds != null)

  return {
    employment: ynStatus(answers.employment.hadJob, employmentComplete),
    savings: ynStatus(answers.savings.hadInterest, savingsComplete),
    investments: ynStatus(answers.investments.hadDividends, investmentsComplete),
    property: ynStatus(answers.property.hadRental, propertyComplete),
    pensions: ynStatus(answers.pensions.hadPension, pensionsComplete),
    family: ynStatus(answers.family.received, familyComplete),
    studentLoan: ynStatus(answers.studentLoan.repaying, studentComplete),
    reliefs: ynStatus(answers.reliefs.hadReliefs, reliefsComplete),
    capitalGains: ynStatus(answers.capitalGains.soldAssets, cgtComplete),
    foreignIncome:
      answers.foreignIncome.hadForeignIncome === 'yes' &&
      (answers.foreignIncome.foreignTaxPaidPounds ?? 0) > 0
        ? 'needs_review'
        : ynStatus(answers.foreignIncome.hadForeignIncome, foreignComplete),
    otherIncome: ynStatus(answers.otherIncome.hadOtherIncome, otherComplete),
  }
}
