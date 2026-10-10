export type ReviewWizardStepId =
  | 'income'
  | 'expenses'
  | 'cis'
  | 'mileage'
  | 'private-use'
  | 'ready'

export type ReviewWizardStep = {
  id: ReviewWizardStepId
  question: string
  checklistLabel: string
}

const BASE_STEPS: ReviewWizardStep[] = [
  {
    id: 'income',
    question: "Have you received any business income that isn't already recorded?",
    checklistLabel: 'Business income',
  },
  {
    id: 'expenses',
    question: "Have you paid any business expenses that aren't recorded yet?",
    checklistLabel: 'Business expenses',
  },
]

const CIS_STEP: ReviewWizardStep = {
  id: 'cis',
  question: 'Do you need to add any CIS vouchers?',
  checklistLabel: 'CIS vouchers',
}

const MILEAGE_STEP: ReviewWizardStep = {
  id: 'mileage',
  question: "Have you done any business mileage that isn't already recorded?",
  checklistLabel: 'Business mileage',
}

const TRAILING_STEPS: ReviewWizardStep[] = [
  {
    id: 'private-use',
    question: 'Have you accounted for private use?',
    checklistLabel: 'Private use',
  },
  {
    id: 'ready',
    question: "You're ready to submit",
    checklistLabel: 'Ready to submit',
  },
]

export function getReviewWizardSteps(options: {
  showCisStep: boolean
  showMileageStep: boolean
}): ReviewWizardStep[] {
  return [
    ...BASE_STEPS,
    ...(options.showCisStep ? [CIS_STEP] : []),
    ...(options.showMileageStep ? [MILEAGE_STEP] : []),
    ...TRAILING_STEPS,
  ]
}

export function getReviewWizardQuestion(
  step: ReviewWizardStep,
  options: {
    hasManualIncome: boolean
    hasManualExpenses: boolean
    hasWizardMileage?: boolean
  },
) {
  if (step.id === 'income' && options.hasManualIncome) {
    return "Any more income that isn't already recorded?"
  }
  if (step.id === 'expenses' && options.hasManualExpenses) {
    return "Any more business expenses that aren't recorded yet?"
  }
  if (step.id === 'mileage' && options.hasWizardMileage) {
    return "Any more business mileage that isn't already recorded?"
  }
  return step.question
}

export type ReviewWizardProgressSummary = {
  answeredCount: number
  totalCount: number
  allAnswered: boolean
  started: boolean
  items: Array<{
    id: ReviewWizardStepId
    label: string
    answered: boolean
  }>
}

export function getReviewWizardProgressSummary(options: {
  showCisStep: boolean
  showMileageStep: boolean
  answeredStepIds: readonly ReviewWizardStepId[]
  markAllAnswered?: boolean
}): ReviewWizardProgressSummary {
  const steps = getReviewWizardSteps({
    showCisStep: options.showCisStep,
    showMileageStep: options.showMileageStep,
  })
  const answered = new Set(options.answeredStepIds)
  const items = steps.map((step) => ({
    id: step.id,
    label: step.checklistLabel,
    answered: options.markAllAnswered === true || answered.has(step.id),
  }))
  const answeredCount = items.filter((item) => item.answered).length
  return {
    answeredCount,
    totalCount: items.length,
    allAnswered: answeredCount === items.length && items.length > 0,
    started: answeredCount > 0,
    items,
  }
}

export function getReviewProgressLabel(progress: ReviewWizardProgressSummary) {
  if (progress.allAnswered) return 'Review complete'
  if (progress.started) return 'Review in progress'
  return 'Review not started'
}

export function getFirstUnansweredReviewStepIndex(options: {
  showCisStep: boolean
  showMileageStep: boolean
  answeredStepIds: readonly ReviewWizardStepId[]
}): number {
  const steps = getReviewWizardSteps({
    showCisStep: options.showCisStep,
    showMileageStep: options.showMileageStep,
  })
  if (steps.length === 0) return 0
  const answered = new Set(options.answeredStepIds)
  const index = steps.findIndex((step) => !answered.has(step.id))
  return index === -1 ? steps.length - 1 : index
}
