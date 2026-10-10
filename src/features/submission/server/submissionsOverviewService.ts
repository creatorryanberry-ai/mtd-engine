import { eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { mtdSubmission } from '~/database/schema'
import {
  buildTaxYear,
  getFinalDeclarationDeadline,
  getQuartersForTaxYear,
  getTaxYearEnd,
  getTaxYearStart,
  parseTaxYearStart,
  type QuarterId,
  type TaxYear,
} from '~/features/mtd/utils/quarterPeriods'
import {
  deriveQuarterStatus,
  deriveYearEndStatus,
  getActiveQuarter,
  getQuarterStatusLabel,
  type QuarterStatus,
  type YearEndStatus,
} from '~/features/mtd/utils/quarterStatus'

import { getQuarterlySummary } from './submissionService'

export type QuarterOverviewItem = {
  quarterId: QuarterId
  label: string
  periodLabel: string
  hmrcUpdatePeriodLabel: string
  deadlineLabel: string
  status: QuarterStatus
  statusLabel: string
  incomeTotal: number
  expenseTotal: number
  taxableProfit: number
  isReady: boolean
  toReview: number
  submittedAt: string | null
  reference: string | null
}

export type YearEndOverview = {
  status: YearEndStatus
  taxYearLabel: string
  periodLabel: string
  finalDeclarationDeadline: string
  finalDeclarationDeadlineLabel: string
}

export type SubmissionsOverview = {
  taxYear: TaxYear
  activeQuarterId: QuarterId
  quarters: QuarterOverviewItem[]
  yearEnd: YearEndOverview
}

function formatToday() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDeadlineLabel(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export async function getSubmissionsOverview(
  userId: string,
  taxYearStartInput?: string,
): Promise<SubmissionsOverview> {
  const taxYearStart = parseTaxYearStart(taxYearStartInput) ?? getTaxYearStart()
  const taxYear = buildTaxYear(taxYearStart)
  const today = formatToday()

  const submissions = await drizzle
    .select()
    .from(mtdSubmission)
    .where(eq(mtdSubmission.userId, userId))

  const submittedForYear = new Map<QuarterId, (typeof submissions)[number]>()
  for (const row of submissions) {
    if (row.taxYearStart === taxYearStart) {
      submittedForYear.set(row.quarterId as QuarterId, row)
    }
  }

  const submittedQuarterIds = new Set(submittedForYear.keys())
  const quartersMeta = getQuartersForTaxYear(taxYearStart)

  const activeQuarter = getActiveQuarter({
    taxYearStart,
    today,
    submittedQuarterIds,
  })

  const quarters: QuarterOverviewItem[] = []

  for (const quarter of quartersMeta) {
    const summary = await getQuarterlySummary(userId, quarter.id, taxYearStart)
    const existing = submittedForYear.get(quarter.id)

    const status = deriveQuarterStatus({
      quarter,
      today,
      submitted: Boolean(existing),
      isReady: summary.isReady,
      toReview: summary.toReview,
    })

    quarters.push({
      quarterId: quarter.id,
      label: quarter.label,
      periodLabel: quarter.periodLabel,
      hmrcUpdatePeriodLabel: quarter.hmrcUpdatePeriodLabel,
      deadlineLabel: quarter.deadlineLabel,
      status,
      statusLabel: getQuarterStatusLabel(status),
      incomeTotal: existing?.incomeTotal ?? summary.incomeTotal,
      expenseTotal: existing?.expenseTotal ?? summary.expenseTotal,
      taxableProfit: existing?.taxableProfit ?? summary.taxableProfit,
      isReady: summary.isReady,
      toReview: summary.toReview,
      submittedAt: existing?.submittedAt ?? null,
      reference: existing?.reference ?? null,
    })
  }

  const taxYearEnd = getTaxYearEnd(taxYearStart)
  const finalDeclarationDeadline = getFinalDeclarationDeadline(taxYearStart)

  const yearEnd: YearEndOverview = {
    status: deriveYearEndStatus({
      taxYearStart,
      taxYearEnd,
      today,
      completed: false,
    }),
    taxYearLabel: taxYear.label,
    periodLabel: `${formatDeadlineLabel(taxYearStart)} – ${formatDeadlineLabel(taxYearEnd)}`,
    finalDeclarationDeadline,
    finalDeclarationDeadlineLabel: formatDeadlineLabel(finalDeclarationDeadline),
  }

  return {
    taxYear,
    activeQuarterId: activeQuarter.id,
    quarters,
    yearEnd,
  }
}

export function resolveSubmissionPeriod(input?: {
  quarterId?: string | null
  taxYearStart?: string | null
}) {
  const taxYearStart =
    parseTaxYearStart(input?.taxYearStart ?? undefined) ?? getTaxYearStart()
  const quarterId =
    (input?.quarterId as QuarterId | undefined) ?? getActiveQuarter({ taxYearStart }).id

  return {
    taxYearStart,
    quarterId,
  }
}
