import type { YearEndReviewAnswers } from './yearEndReviewAnswersStorage'

export type YearEndReviewStepId =
  | 'childBenefit'
  | 'employment'
  | 'overseasRental'
  | 'bankInterest'
  | 'dividends'
  | 'statePension'
  | 'privatePension'
  | 'otherTaxableIncome'
  | 'assetSales'
  | 'pensionContributions'
  | 'giftAid'
  | 'studentLoan'
  | 'marriageAllowance'
  | 'blindPersonsAllowance'
  | 'ukResidence'
  | 'lossesBroughtForward'
  | 'complete'

export type YearEndYn = 'yes' | 'no'

export type YearEndChildBenefitWho = 'you' | 'partner' | 'both'

export type YearEndAssetSaleType =
  | 'shares'
  | 'property'
  | 'cryptocurrency'
  | 'businessAssets'

export type YearEndStudentLoan =
  | 'none'
  | 'plan1'
  | 'plan2'
  | 'plan4'
  | 'plan5'
  | 'postgraduate'

export type YearEndMarriageDirection = 'receiving' | 'transferring'

export type YearEndReviewStep = {
  id: YearEndReviewStepId
  question: string
  subtitle: string
}

export const YEAR_END_CHILD_BENEFIT_WHO_OPTIONS: Array<{
  id: YearEndChildBenefitWho
  label: string
}> = [
  { id: 'you', label: 'You' },
  { id: 'partner', label: 'Your partner' },
  { id: 'both', label: 'Both' },
]

export const YEAR_END_ASSET_SALE_OPTIONS: Array<{
  id: YearEndAssetSaleType
  label: string
}> = [
  { id: 'shares', label: 'Shares' },
  { id: 'property', label: 'Property' },
  { id: 'cryptocurrency', label: 'Cryptocurrency' },
  { id: 'businessAssets', label: 'Business assets' },
]

export const YEAR_END_STUDENT_LOAN_OPTIONS: Array<{
  id: YearEndStudentLoan
  label: string
}> = [
  { id: 'none', label: 'None' },
  { id: 'plan1', label: 'Plan 1' },
  { id: 'plan2', label: 'Plan 2' },
  { id: 'plan4', label: 'Plan 4' },
  { id: 'plan5', label: 'Plan 5' },
  { id: 'postgraduate', label: 'Postgraduate Loan' },
]

export const YEAR_END_MARRIAGE_DIRECTION_OPTIONS: Array<{
  id: YearEndMarriageDirection
  label: string
}> = [
  { id: 'receiving', label: 'Receiving' },
  { id: 'transferring', label: 'Transferring' },
]

const YEAR_END_INTRO_NOTE =
  'Rental income and self-employed income are already tracked in the app.'

const STEPS: YearEndReviewStep[] = [
  {
    id: 'childBenefit',
    question: 'Do you or your partner receive Child Benefit?',
    subtitle: YEAR_END_INTRO_NOTE,
  },
  {
    id: 'employment',
    question: 'Will you be employed during this tax year?',
    subtitle: '',
  },
  {
    id: 'overseasRental',
    question: 'Will you receive rental income from overseas property?',
    subtitle: '',
  },
  {
    id: 'bankInterest',
    question: 'Do you expect to receive bank or building society interest?',
    subtitle: '',
  },
  {
    id: 'dividends',
    question: 'Do you expect to receive dividends?',
    subtitle: '',
  },
  {
    id: 'statePension',
    question: 'Will you receive State Pension?',
    subtitle: '',
  },
  {
    id: 'privatePension',
    question: 'Will you receive any private or workplace pension income?',
    subtitle: '',
  },
  {
    id: 'otherTaxableIncome',
    question: 'Do you expect to receive any other taxable income?',
    subtitle: '',
  },
  {
    id: 'assetSales',
    question: 'Do you expect to sell any assets during the tax year?',
    subtitle: '',
  },
  {
    id: 'pensionContributions',
    question: 'Will you make personal pension contributions?',
    subtitle: '',
  },
  {
    id: 'giftAid',
    question: 'Will you make Gift Aid donations?',
    subtitle: '',
  },
  {
    id: 'studentLoan',
    question: 'Do you repay a Student Loan?',
    subtitle: '',
  },
  {
    id: 'marriageAllowance',
    question: 'Do you claim or transfer Marriage Allowance?',
    subtitle: '',
  },
  {
    id: 'blindPersonsAllowance',
    question: "Are you entitled to Blind Person's Allowance?",
    subtitle: '',
  },
  {
    id: 'ukResidence',
    question: 'Will you be UK resident for the whole tax year?',
    subtitle: '',
  },
  {
    id: 'lossesBroughtForward',
    question: 'Do you have any losses brought forward?',
    subtitle: '',
  },
  {
    id: 'complete',
    question: 'Your year is complete!',
    subtitle: 'Everything looks good.',
  },
]

export function getYearEndReviewSteps(): YearEndReviewStep[] {
  return STEPS
}

export function getFirstUnansweredYearEndStepIndex(options: {
  answeredStepIds: readonly YearEndReviewStepId[]
}): number {
  const steps = getYearEndReviewSteps()
  if (steps.length === 0) return 0
  const answered = new Set(options.answeredStepIds)
  const index = steps.findIndex((step) => !answered.has(step.id))
  return index === -1 ? steps.length - 1 : index
}

export function toggleYearEndAssetSaleType(
  current: readonly YearEndAssetSaleType[],
  tapped: YearEndAssetSaleType,
): YearEndAssetSaleType[] {
  if (current.includes(tapped)) {
    return current.filter((id) => id !== tapped)
  }
  return [...current, tapped]
}

function hasYn(answer: YearEndYn | null): boolean {
  return answer != null
}

export function canContinueYearEndStep(
  stepId: YearEndReviewStepId,
  answers: YearEndReviewAnswers,
): boolean {
  switch (stepId) {
    case 'childBenefit':
      return hasYn(answers.childBenefit.answer)
    case 'employment':
      return hasYn(answers.employment.answer)
    case 'overseasRental':
      return hasYn(answers.overseasRental.answer)
    case 'bankInterest':
      return hasYn(answers.bankInterest.answer)
    case 'dividends':
      return hasYn(answers.dividends.answer)
    case 'statePension':
      return hasYn(answers.statePension.answer)
    case 'privatePension':
      return hasYn(answers.privatePension.answer)
    case 'otherTaxableIncome':
      return hasYn(answers.otherTaxableIncome.answer)
    case 'assetSales':
      return hasYn(answers.assetSales.answer)
    case 'pensionContributions':
      return hasYn(answers.pensionContributions.answer)
    case 'giftAid':
      return hasYn(answers.giftAid.answer)
    case 'studentLoan':
      return answers.studentLoan != null
    case 'marriageAllowance':
      return hasYn(answers.marriageAllowance.answer)
    case 'blindPersonsAllowance':
      return hasYn(answers.blindPersonsAllowance)
    case 'ukResidence':
      return hasYn(answers.ukResidence.answer)
    case 'lossesBroughtForward':
      return hasYn(answers.lossesBroughtForward.answer)
    case 'complete':
      return true
  }
}
