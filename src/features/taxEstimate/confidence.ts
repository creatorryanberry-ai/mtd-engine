import type {
  CategoryAnswerStatus,
  ConfidenceLevel,
  EstimateCategoryId,
  TaxableBusinessProfit,
} from './types'

const MAIN_CATEGORIES: EstimateCategoryId[] = [
  'employment',
  'savings',
  'investments',
  'pensions',
]

export function scoreTaxEstimateConfidence(input: {
  categoryStatuses: Record<EstimateCategoryId, CategoryAnswerStatus>
  business: TaxableBusinessProfit
  cgtNeedsMore: boolean
  foreignNeedsReview: boolean
  payeUnknown: boolean
}): { level: ConfidenceLevel; completionPercent: number; message: string } {
  const statuses = Object.values(input.categoryStatuses)
  const answered = statuses.filter((status) => status !== 'not_answered').length
  const total = statuses.length
  const completionPercent = Math.round((answered / total) * 100)

  const unansweredMain = MAIN_CATEGORIES.filter(
    (id) => input.categoryStatuses[id] === 'not_answered',
  )
  const needsReview = statuses.some((status) => status === 'needs_review')
  const incomplete = statuses.some((status) => status === 'incomplete')

  let level: ConfidenceLevel = 'high'
  let message = 'We know about the main areas that affect your tax.'

  if (answered <= 1 && unansweredMain.length >= 3) {
    level = 'low'
    message = 'We only know about your business so far.'
  } else if (
    unansweredMain.length > 0 ||
    !input.business.yearComplete ||
    input.payeUnknown ||
    input.cgtNeedsMore ||
    input.foreignNeedsReview ||
    needsReview ||
    incomplete ||
    input.business.cisIncomplete
  ) {
    level = 'medium'
    const missing = unansweredMain
      .map((id) => {
        if (id === 'employment') return 'employment'
        if (id === 'savings') return 'savings'
        if (id === 'investments') return 'investments'
        return 'pensions'
      })
      .join(', ')
    message = missing
      ? `We know about your business, but you haven't checked ${missing} yet.`
      : 'We know about your business and employment, but a few details still need a look.'
  }

  if (
    completionPercent >= 90 &&
    !input.cgtNeedsMore &&
    !input.foreignNeedsReview &&
    !needsReview
  ) {
    level = 'high'
    message = 'We know about the main areas that affect your tax.'
  }

  return { level, completionPercent, message }
}
