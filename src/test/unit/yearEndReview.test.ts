import { describe, expect, it } from 'vitest'

import { EMPTY_YEAR_END_ANSWERS } from '~/features/mtd/components/year-end-review/yearEndReviewAnswersStorage'
import {
  canContinueYearEndStep,
  getFirstUnansweredYearEndStepIndex,
  getYearEndReviewSteps,
  toggleYearEndAssetSaleType,
} from '~/features/mtd/components/year-end-review/yearEndReviewSteps'

describe('getYearEndReviewSteps', () => {
  it('returns all 16 questions plus complete', () => {
    expect(getYearEndReviewSteps().map((step) => step.id)).toEqual([
      'childBenefit',
      'employment',
      'overseasRental',
      'bankInterest',
      'dividends',
      'statePension',
      'privatePension',
      'otherTaxableIncome',
      'assetSales',
      'pensionContributions',
      'giftAid',
      'studentLoan',
      'marriageAllowance',
      'blindPersonsAllowance',
      'ukResidence',
      'lossesBroughtForward',
      'complete',
    ])
  })

  it('uses the provided question text', () => {
    const steps = getYearEndReviewSteps()
    expect(steps[0]?.question).toBe('Do you or your partner receive Child Benefit?')
    expect(steps[11]?.question).toBe('Do you repay a Student Loan?')
    expect(steps[13]?.question).toBe("Are you entitled to Blind Person's Allowance?")
  })
})

describe('toggleYearEndAssetSaleType', () => {
  it('adds and removes asset types', () => {
    expect(toggleYearEndAssetSaleType([], 'shares')).toEqual(['shares'])
    expect(toggleYearEndAssetSaleType(['shares'], 'property')).toEqual([
      'shares',
      'property',
    ])
    expect(toggleYearEndAssetSaleType(['shares', 'property'], 'shares')).toEqual([
      'property',
    ])
  })
})

describe('canContinueYearEndStep', () => {
  it('requires yes/no on yn steps', () => {
    expect(canContinueYearEndStep('childBenefit', EMPTY_YEAR_END_ANSWERS)).toBe(false)
    expect(
      canContinueYearEndStep('childBenefit', {
        ...EMPTY_YEAR_END_ANSWERS,
        childBenefit: { ...EMPTY_YEAR_END_ANSWERS.childBenefit, answer: 'no' },
      }),
    ).toBe(true)
  })

  it('requires a student loan selection', () => {
    expect(canContinueYearEndStep('studentLoan', EMPTY_YEAR_END_ANSWERS)).toBe(false)
    expect(
      canContinueYearEndStep('studentLoan', {
        ...EMPTY_YEAR_END_ANSWERS,
        studentLoan: 'none',
      }),
    ).toBe(true)
    expect(
      canContinueYearEndStep('studentLoan', {
        ...EMPTY_YEAR_END_ANSWERS,
        studentLoan: 'plan2',
      }),
    ).toBe(true)
  })

  it('allows complete without further answers', () => {
    expect(canContinueYearEndStep('complete', EMPTY_YEAR_END_ANSWERS)).toBe(true)
  })
})

describe('getFirstUnansweredYearEndStepIndex', () => {
  it('starts at the first step', () => {
    expect(getFirstUnansweredYearEndStepIndex({ answeredStepIds: [] })).toBe(0)
  })

  it('skips answered steps', () => {
    expect(
      getFirstUnansweredYearEndStepIndex({
        answeredStepIds: ['childBenefit', 'employment'],
      }),
    ).toBe(2)
  })

  it('returns the last step when everything is answered', () => {
    const allIds = getYearEndReviewSteps().map((step) => step.id)
    expect(
      getFirstUnansweredYearEndStepIndex({
        answeredStepIds: allIds,
      }),
    ).toBe(allIds.length - 1)
  })
})
