import { createStorage } from '@mtd/helpers'

import type {
  YearEndAssetSaleType,
  YearEndChildBenefitWho,
  YearEndMarriageDirection,
  YearEndStudentLoan,
  YearEndYn,
} from './yearEndReviewSteps'

export type YearEndReviewAnswers = {
  childBenefit: {
    answer: YearEndYn | null
    numberOfChildren: string
    whoReceives: YearEndChildBenefitWho | null
  }
  employment: {
    answer: YearEndYn | null
    employerName: string
    expectedAnnualSalary: string
    expectedBonus: string
    companyCarValue: string
    companyFuelBenefit: string
    medicalInsuranceValue: string
    otherBenefits: string
    taxCode: string
  }
  overseasRental: {
    answer: YearEndYn | null
    country: string
    estimatedAnnualIncome: string
    estimatedAnnualExpenses: string
    foreignTaxPaid: string
  }
  bankInterest: {
    answer: YearEndYn | null
    estimatedAnnualInterest: string
  }
  dividends: {
    answer: YearEndYn | null
    estimatedUkDividends: string
    estimatedForeignDividends: string
  }
  statePension: {
    answer: YearEndYn | null
    estimatedAnnualAmount: string
  }
  privatePension: {
    answer: YearEndYn | null
    estimatedAnnualPensionIncome: string
    estimatedTaxDeducted: string
  }
  otherTaxableIncome: {
    answer: YearEndYn | null
    description: string
    estimatedAnnualAmount: string
  }
  assetSales: {
    answer: YearEndYn | null
    types: YearEndAssetSaleType[]
    estimatedGain: string
  }
  pensionContributions: {
    answer: YearEndYn | null
    estimatedAnnualGrossContribution: string
  }
  giftAid: {
    answer: YearEndYn | null
    estimatedAnnualDonations: string
  }
  studentLoan: YearEndStudentLoan | null
  marriageAllowance: {
    answer: YearEndYn | null
    direction: YearEndMarriageDirection | null
  }
  blindPersonsAllowance: YearEndYn | null
  ukResidence: {
    answer: YearEndYn | null
    anyOverseasIncome: YearEndYn | null
    anyPeriodsWorkingAbroad: YearEndYn | null
  }
  lossesBroughtForward: {
    answer: YearEndYn | null
    tradingLosses: string
    propertyLosses: string
    capitalLosses: string
  }
}

export const EMPTY_YEAR_END_ANSWERS: YearEndReviewAnswers = {
  childBenefit: {
    answer: null,
    numberOfChildren: '',
    whoReceives: null,
  },
  employment: {
    answer: null,
    employerName: '',
    expectedAnnualSalary: '',
    expectedBonus: '',
    companyCarValue: '',
    companyFuelBenefit: '',
    medicalInsuranceValue: '',
    otherBenefits: '',
    taxCode: '',
  },
  overseasRental: {
    answer: null,
    country: '',
    estimatedAnnualIncome: '',
    estimatedAnnualExpenses: '',
    foreignTaxPaid: '',
  },
  bankInterest: {
    answer: null,
    estimatedAnnualInterest: '',
  },
  dividends: {
    answer: null,
    estimatedUkDividends: '',
    estimatedForeignDividends: '',
  },
  statePension: {
    answer: null,
    estimatedAnnualAmount: '',
  },
  privatePension: {
    answer: null,
    estimatedAnnualPensionIncome: '',
    estimatedTaxDeducted: '',
  },
  otherTaxableIncome: {
    answer: null,
    description: '',
    estimatedAnnualAmount: '',
  },
  assetSales: {
    answer: null,
    types: [],
    estimatedGain: '',
  },
  pensionContributions: {
    answer: null,
    estimatedAnnualGrossContribution: '',
  },
  giftAid: {
    answer: null,
    estimatedAnnualDonations: '',
  },
  studentLoan: null,
  marriageAllowance: {
    answer: null,
    direction: null,
  },
  blindPersonsAllowance: null,
  ukResidence: {
    answer: null,
    anyOverseasIncome: null,
    anyPeriodsWorkingAbroad: null,
  },
  lossesBroughtForward: {
    answer: null,
    tradingLosses: '',
    propertyLosses: '',
    capitalLosses: '',
  },
}

const storage = createStorage<string, YearEndReviewAnswers>('year-end-review-answers-v2')

function storageKey(userId: string, taxYearStart: string) {
  return `${userId}:${taxYearStart}:YE`
}

export function loadYearEndReviewAnswers(
  userId: string,
  taxYearStart: string,
): YearEndReviewAnswers {
  return storage.get(storageKey(userId, taxYearStart)) ?? EMPTY_YEAR_END_ANSWERS
}

export function saveYearEndReviewAnswers(
  userId: string,
  taxYearStart: string,
  answers: YearEndReviewAnswers,
) {
  storage.set(storageKey(userId, taxYearStart), answers)
}

export function clearYearEndReviewAnswersForUser(userId: string) {
  const prefix = `${userId}:`
  for (const key of storage.keys()) {
    if (key.startsWith(prefix)) {
      storage.remove(key)
    }
  }
}
