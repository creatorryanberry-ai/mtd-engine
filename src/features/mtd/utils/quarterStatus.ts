import {
  addDays,
  getCurrentQuarter,
  getQuartersForTaxYear,
  type QuarterId,
  type QuarterInfo,
} from './quarterPeriods'

export type QuarterStatus =
  | 'upcoming'
  | 'current'
  | 'readyForReview'
  | 'reviewRequired'
  | 'readyToSubmit'
  | 'submitted'
  | 'overdue'

export type YearEndStatus = 'locked' | 'available' | 'completed'

export type QuarterStatusContext = {
  quarter: QuarterInfo
  today: string
  submitted: boolean
  isReady: boolean
  toReview: number
  reviewComplete?: boolean
}

const EARLY_SUBMIT_DAYS = 10

export function deriveQuarterStatus(input: QuarterStatusContext): QuarterStatus {
  if (input.submitted) return 'submitted'

  const { quarter, today } = input
  const periodEnded = today > quarter.periodEnd
  const canSubmitEarly = today >= addDays(quarter.periodEnd, -EARLY_SUBMIT_DAYS)
  const pastDeadline = today > quarter.deadline

  if (!periodEnded && !canSubmitEarly) {
    if (today >= quarter.periodStart) return 'current'
    return 'upcoming'
  }

  if (pastDeadline) return 'overdue'
  if (input.isReady) return 'readyToSubmit'
  if (input.toReview > 0) return 'reviewRequired'
  if (input.reviewComplete === false) return 'reviewRequired'
  return 'readyForReview'
}

export function deriveYearEndStatus(input: {
  taxYearStart: string
  taxYearEnd: string
  today: string
  completed?: boolean
}): YearEndStatus {
  if (input.completed) return 'completed'
  // demo: always unlock year-end review (ignore april 5 gate)
  return 'available'
}

export function getActiveQuarter(input: {
  taxYearStart: string
  today?: string
  submittedQuarterIds?: Set<QuarterId>
  obligationPeriodEnd?: string | null
}): QuarterInfo {
  const today = input.today ?? formatToday()
  const quarters = getQuartersForTaxYear(input.taxYearStart)
  const submitted = input.submittedQuarterIds ?? new Set<QuarterId>()

  if (input.obligationPeriodEnd) {
    const fromObligation = quarters.find(
      (quarter) => quarter.periodEnd === input.obligationPeriodEnd,
    )
    if (fromObligation && !submitted.has(fromObligation.id)) {
      return fromObligation
    }
  }

  for (const quarter of quarters) {
    if (submitted.has(quarter.id)) continue

    const periodEnded = today > quarter.periodEnd
    const canSubmitEarly = today >= addDays(quarter.periodEnd, -EARLY_SUBMIT_DAYS)

    if (periodEnded || canSubmitEarly) {
      return quarter
    }
  }

  return getCurrentQuarter(new Date(`${today}T12:00:00`))
}

function formatToday() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getQuarterStatusLabel(status: QuarterStatus) {
  switch (status) {
    case 'upcoming':
      return 'Upcoming'
    case 'current':
      return 'In progress'
    case 'readyForReview':
      return 'Ready for review'
    case 'reviewRequired':
      return 'Review required'
    case 'readyToSubmit':
      return 'Ready to submit'
    case 'submitted':
      return 'Submitted'
    case 'overdue':
      return 'Overdue'
  }
}
