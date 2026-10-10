import { describe, expect, it } from 'vitest'

import { getQuarterPeriodStart } from '~/features/mtd/utils/quarterPeriods'
import {
  getFirstUnansweredReviewStepIndex,
  getReviewWizardProgressSummary,
  getReviewWizardQuestion,
  getReviewWizardSteps,
} from '~/features/mtd/components/review-wizard/reviewWizardSteps'

describe('getQuarterPeriodStart', () => {
  it('returns tax year start for Q1', () => {
    expect(getQuarterPeriodStart('2025-04-06', 'Q1')).toBe('2025-04-06')
  })

  it('returns the day after the previous quarter end', () => {
    expect(getQuarterPeriodStart('2025-04-06', 'Q2')).toBe('2025-07-06')
    expect(getQuarterPeriodStart('2025-04-06', 'Q3')).toBe('2025-10-06')
    expect(getQuarterPeriodStart('2025-04-06', 'Q4')).toBe('2026-01-06')
  })
})

describe('getReviewWizardSteps', () => {
  it('includes cis and mileage when enabled', () => {
    expect(
      getReviewWizardSteps({ showCisStep: true, showMileageStep: true }).map(
        (step) => step.id,
      ),
    ).toEqual(['income', 'expenses', 'cis', 'mileage', 'private-use', 'ready'])
  })

  it('omits optional steps when disabled', () => {
    expect(
      getReviewWizardSteps({ showCisStep: false, showMileageStep: false }).map(
        (step) => step.id,
      ),
    ).toEqual(['income', 'expenses', 'private-use', 'ready'])
  })
})

describe('getReviewWizardQuestion', () => {
  const [incomeStep, expensesStep] = getReviewWizardSteps({
    showCisStep: false,
    showMileageStep: false,
  })

  it('asks about any income first', () => {
    expect(
      getReviewWizardQuestion(incomeStep!, {
        hasManualIncome: false,
        hasManualExpenses: false,
      }),
    ).toBe("Have you received any business income that isn't already recorded?")
  })

  it('asks about more income after some is listed', () => {
    expect(
      getReviewWizardQuestion(incomeStep!, {
        hasManualIncome: true,
        hasManualExpenses: false,
      }),
    ).toBe("Any more income that isn't already recorded?")
  })

  it('asks about any expenses first', () => {
    expect(
      getReviewWizardQuestion(expensesStep!, {
        hasManualIncome: false,
        hasManualExpenses: false,
      }),
    ).toBe("Have you paid any business expenses that aren't recorded yet?")
  })

  it('asks about more expenses after some is listed', () => {
    expect(
      getReviewWizardQuestion(expensesStep!, {
        hasManualIncome: false,
        hasManualExpenses: true,
      }),
    ).toBe("Any more business expenses that aren't recorded yet?")
  })

  it('asks about any mileage first', () => {
    const mileageStep = getReviewWizardSteps({
      showCisStep: false,
      showMileageStep: true,
    }).find((step) => step.id === 'mileage')

    expect(
      getReviewWizardQuestion(mileageStep!, {
        hasManualIncome: false,
        hasManualExpenses: false,
        hasWizardMileage: false,
      }),
    ).toBe("Have you done any business mileage that isn't already recorded?")
  })

  it('asks about more mileage after some is listed', () => {
    const mileageStep = getReviewWizardSteps({
      showCisStep: false,
      showMileageStep: true,
    }).find((step) => step.id === 'mileage')

    expect(
      getReviewWizardQuestion(mileageStep!, {
        hasManualIncome: false,
        hasManualExpenses: false,
        hasWizardMileage: true,
      }),
    ).toBe("Any more business mileage that isn't already recorded?")
  })
})

describe('getFirstUnansweredReviewStepIndex', () => {
  it('starts at the first step when nothing is answered', () => {
    expect(
      getFirstUnansweredReviewStepIndex({
        showCisStep: false,
        showMileageStep: false,
        answeredStepIds: [],
      }),
    ).toBe(0)
  })

  it('skips answered steps', () => {
    expect(
      getFirstUnansweredReviewStepIndex({
        showCisStep: false,
        showMileageStep: false,
        answeredStepIds: ['income', 'expenses'],
      }),
    ).toBe(2)
  })

  it('lands on optional steps when earlier ones are done', () => {
    expect(
      getFirstUnansweredReviewStepIndex({
        showCisStep: true,
        showMileageStep: true,
        answeredStepIds: ['income', 'expenses'],
      }),
    ).toBe(2)
  })

  it('returns the last step when everything is answered', () => {
    expect(
      getFirstUnansweredReviewStepIndex({
        showCisStep: false,
        showMileageStep: false,
        answeredStepIds: ['income', 'expenses', 'private-use', 'ready'],
      }),
    ).toBe(3)
  })
})

describe('getReviewWizardProgressSummary', () => {
  it('marks every step answered when markAllAnswered is set', () => {
    const progress = getReviewWizardProgressSummary({
      showCisStep: true,
      showMileageStep: true,
      answeredStepIds: [],
      markAllAnswered: true,
    })

    expect(progress.answeredCount).toBe(6)
    expect(progress.allAnswered).toBe(true)
    expect(progress.items.every((item) => item.answered)).toBe(true)
  })
})
