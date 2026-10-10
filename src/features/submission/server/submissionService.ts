import { and, desc, eq, gte, lte } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { device, mtdSubmission, mtdTransaction } from '~/database/schema'
import { needsReview } from '~/features/categorisation/categorisationUtils'
import { getHmrcConnectionStatus } from '~/features/hmrc/server/connectionService'
import { getHmrcInYearTaxEstimate } from '~/features/hmrc/server/calculations'
import { isHmrcConfigured } from '~/features/hmrc/server/config'
import { submitSelfEmploymentQuarterlyUpdate } from '~/features/hmrc/server/selfEmployment'
import {
  getHmrcCategory,
  getHmrcCategoryLabel,
  getHmrcCategoryType,
} from '~/features/mtd/categories/hmrcCategories'
import {
  getCurrentQuarter,
  getQuarterInfo,
  getTaxYearStart,
  parseQuarterId,
  parseTaxYearStart,
  type QuarterId,
} from '~/features/mtd/utils/quarterPeriods'
import { getActiveQuarter } from '~/features/mtd/utils/quarterStatus'

import type { HmrcFraudHeadersInput } from '~/features/hmrc/types'

const EXCLUDED_CATEGORIES = new Set(['transfer', 'personal', 'uncategorised'])
const MOCK_TAX_RATE = 0.15

export type SubmissionCategoryLine = {
  id: string
  label: string
  hmrcBox?: number
  total: number
  type: 'income' | 'expense'
}

export type SubmissionBlocker = {
  id: string
  message: string
}

export type QuarterlySummary = {
  quarter: ReturnType<typeof getQuarterInfo>
  categoryLines: SubmissionCategoryLine[]
  incomeTotal: number
  expenseTotal: number
  taxableProfit: number
  transactionCount: number
  toReview: number
  uncategorised: number
  blockers: SubmissionBlocker[]
  isReady: boolean
  existingSubmission: {
    reference: string
    submittedAt: string
    incomeTotal: number
    expenseTotal: number
    taxableProfit: number
    taxDue: number
    source: 'mock' | 'hmrc'
  } | null
}

export type SubmitQuarterlyResult = {
  status: 'ACCEPTED'
  reference: string
  submittedAt: string
  incomeTotal: number
  expenseTotal: number
  taxableProfit: number
  taxDue: number
  source: 'mock' | 'hmrc'
  hmrcPeriodId?: string | null
}

type SubmitQuarterlyOptions = {
  request?: Request
  fraudHeaders?: HmrcFraudHeadersInput
}

function generateReference() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `XZMHJMTD${suffix}`
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

async function getTransactionsInPeriod(
  userId: string,
  taxYearStart: string,
  periodEnd: string,
) {
  const db = drizzle

  return db
    .select()
    .from(mtdTransaction)
    .where(
      and(
        eq(mtdTransaction.userId, userId),
        gte(mtdTransaction.date, taxYearStart),
        lte(mtdTransaction.date, periodEnd),
      ),
    )
}

function buildCategoryLines(
  rows: Awaited<ReturnType<typeof getTransactionsInPeriod>>,
): SubmissionCategoryLine[] {
  const totals = new Map<string, number>()

  for (const row of rows) {
    if (EXCLUDED_CATEGORIES.has(row.hmrcCategory)) continue

    totals.set(row.hmrcCategory, (totals.get(row.hmrcCategory) ?? 0) + row.amount)
  }

  const lines: SubmissionCategoryLine[] = []

  for (const [id, total] of totals) {
    const type = getHmrcCategoryType(id)
    if (type !== 'income' && type !== 'expense') continue
    if (Math.abs(total) < 0.005) continue

    lines.push({
      id,
      label: getHmrcCategoryLabel(id),
      hmrcBox: getHmrcCategory(id)?.hmrcBox,
      total: roundMoney(type === 'expense' ? Math.abs(total) : total),
      type,
    })
  }

  return lines.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'income' ? -1 : 1
    return a.label.localeCompare(b.label)
  })
}

function buildBlockers(input: {
  transactionCount: number
  toReview: number
  uncategorised: number
}): SubmissionBlocker[] {
  const blockers: SubmissionBlocker[] = []

  // empty periods are allowed — user can submit a nil quarterly update

  if (input.toReview > 0) {
    blockers.push({
      id: 'to-review',
      message: `${input.toReview} transaction${input.toReview === 1 ? '' : 's'} still need review`,
    })
  }

  if (input.uncategorised > 0) {
    blockers.push({
      id: 'uncategorised',
      message: `${input.uncategorised} uncategorised transaction${input.uncategorised === 1 ? '' : 's'} in this period`,
    })
  }

  return blockers
}

async function getWorkerFraudHeaders(userId: string): Promise<HmrcFraudHeadersInput> {
  const [latestDevice] = await drizzle
    .select()
    .from(device)
    .where(eq(device.userId, userId))
    .orderBy(desc(device.lastActiveAt))
    .limit(1)

  return {
    platform: latestDevice?.platform ?? undefined,
    osVersion: latestDevice?.platformVersion ?? undefined,
    appVersion: latestDevice?.appVersion ?? undefined,
    deviceId: latestDevice?.id ?? undefined,
  }
}

async function resolveTaxDue(input: {
  userId: string
  summary: QuarterlySummary
  taxableProfit: number
  request?: Request
  fraudHeaders?: HmrcFraudHeadersInput
}) {
  if (!isHmrcConfigured() || !input.request) {
    return roundMoney(Math.max(0, input.taxableProfit * MOCK_TAX_RATE))
  }

  const connection = await getHmrcConnectionStatus(input.userId)
  if (!connection.connected) {
    return roundMoney(Math.max(0, input.taxableProfit * MOCK_TAX_RATE))
  }

  try {
    const estimate = await getHmrcInYearTaxEstimate({
      userId: input.userId,
      taxYearStart: input.summary.quarter.taxYearStart,
      request: input.request,
      fraudHeaders: input.fraudHeaders,
    })
    return (
      estimate.totalIncomeTaxAndNicsDue ??
      roundMoney(Math.max(0, input.taxableProfit * MOCK_TAX_RATE))
    )
  } catch (error) {
    console.warn('[submission] HMRC tax estimate failed, using local estimate', error)
    return roundMoney(Math.max(0, input.taxableProfit * MOCK_TAX_RATE))
  }
}

export async function getExistingSubmission(
  userId: string,
  quarterId: QuarterId,
  taxYearStart: string,
) {
  const db = drizzle

  const [row] = await db
    .select()
    .from(mtdSubmission)
    .where(
      and(
        eq(mtdSubmission.userId, userId),
        eq(mtdSubmission.quarterId, quarterId),
        eq(mtdSubmission.taxYearStart, taxYearStart),
      ),
    )
    .limit(1)

  return row ?? null
}

export async function getQuarterlySummary(
  userId: string,
  quarterIdInput?: QuarterId,
  taxYearStartInput?: string,
): Promise<QuarterlySummary> {
  const taxYearStart = parseTaxYearStart(taxYearStartInput) ?? getTaxYearStart()
  const quarter = quarterIdInput
    ? getQuarterInfo(quarterIdInput, taxYearStart)
    : getActiveQuarter({ taxYearStart })

  const rows = await getTransactionsInPeriod(
    userId,
    quarter.taxYearStart,
    quarter.periodEnd,
  )
  const categoryLines = buildCategoryLines(rows)

  let incomeTotal = 0
  let expenseTotal = 0
  let toReview = 0
  let uncategorised = 0

  for (const row of rows) {
    if (needsReview(row.confidence, row.reviewedAt)) {
      toReview += 1
    }

    if (row.hmrcCategory === 'uncategorised') {
      uncategorised += 1
      continue
    }

    if (EXCLUDED_CATEGORIES.has(row.hmrcCategory)) continue

    const type = getHmrcCategoryType(row.hmrcCategory)
    if (type === 'income') {
      incomeTotal += row.amount
    } else if (type === 'expense') {
      expenseTotal += Math.abs(row.amount)
    }
  }

  incomeTotal = roundMoney(incomeTotal)
  expenseTotal = roundMoney(expenseTotal)
  const taxableProfit = roundMoney(incomeTotal - expenseTotal)

  const blockers = buildBlockers({
    transactionCount: rows.length,
    toReview,
    uncategorised,
  })

  const existing = await getExistingSubmission(userId, quarter.id, quarter.taxYearStart)

  return {
    quarter,
    categoryLines,
    incomeTotal,
    expenseTotal,
    taxableProfit,
    transactionCount: rows.length,
    toReview,
    uncategorised,
    blockers,
    isReady: blockers.length === 0,
    existingSubmission: existing
      ? {
          reference: existing.reference,
          submittedAt: existing.submittedAt,
          incomeTotal: existing.incomeTotal,
          expenseTotal: existing.expenseTotal,
          taxableProfit: existing.taxableProfit,
          taxDue: existing.taxDue,
          source: existing.source === 'hmrc' ? 'hmrc' : 'mock',
        }
      : null,
  }
}

export async function submitQuarterlyUpdate(
  userId: string,
  quarterIdInput?: string,
  options: SubmitQuarterlyOptions & { taxYearStart?: string } = {},
): Promise<SubmitQuarterlyResult> {
  const quarterId = parseQuarterId(quarterIdInput) ?? getCurrentQuarter().id
  const taxYearStart = parseTaxYearStart(options.taxYearStart) ?? getTaxYearStart()
  const summary = await getQuarterlySummary(userId, quarterId, taxYearStart)

  if (!summary.isReady) {
    throw new Error('Submission is not ready')
  }

  if (summary.existingSubmission) {
    throw new Error('This quarter has already been submitted')
  }

  const submittedAt = new Date().toISOString()
  const connection = await getHmrcConnectionStatus(userId)
  const canSubmitToHmrc = isHmrcConfigured() && connection.connected

  let reference = generateReference()
  let source: 'mock' | 'hmrc' = 'mock'
  let hmrcPeriodId: string | null = null

  if (canSubmitToHmrc) {
    const fraudHeaders =
      options.fraudHeaders ??
      (options.request ? undefined : await getWorkerFraudHeaders(userId))

    const hmrcResult = await submitSelfEmploymentQuarterlyUpdate({
      userId,
      request: options.request ?? new Request('http://localhost/submission'),
      fraudHeaders,
      categoryLines: summary.categoryLines,
      taxYearStart: summary.quarter.taxYearStart,
      periodEnd: summary.quarter.periodEnd,
      quarterId: summary.quarter.id,
    })

    reference = hmrcResult.reference
    source = hmrcResult.source
    hmrcPeriodId = hmrcResult.hmrcPeriodId
  }

  const taxDue = await resolveTaxDue({
    userId,
    summary,
    taxableProfit: summary.taxableProfit,
    request: source === 'hmrc' ? options.request : undefined,
    fraudHeaders: options.fraudHeaders,
  })

  const id = crypto.randomUUID()
  const db = drizzle

  await db.insert(mtdSubmission).values({
    id,
    userId,
    quarterId: summary.quarter.id,
    taxYearStart: summary.quarter.taxYearStart,
    periodEnd: summary.quarter.periodEnd,
    submittedAt,
    reference,
    incomeTotal: summary.incomeTotal,
    expenseTotal: summary.expenseTotal,
    taxableProfit: summary.taxableProfit,
    taxDue,
    payload: JSON.stringify(summary.categoryLines),
    source,
    hmrcPeriodId,
  })

  return {
    status: 'ACCEPTED',
    reference,
    submittedAt,
    incomeTotal: summary.incomeTotal,
    expenseTotal: summary.expenseTotal,
    taxableProfit: summary.taxableProfit,
    taxDue,
    source,
    hmrcPeriodId,
  }
}

export async function unsubmitQuarterlyUpdate(
  userId: string,
  quarterIdInput?: string,
  taxYearStartInput?: string,
) {
  const quarterId = parseQuarterId(quarterIdInput) ?? getCurrentQuarter().id
  const taxYearStart = parseTaxYearStart(taxYearStartInput) ?? getTaxYearStart()
  const quarter = getQuarterInfo(quarterId, taxYearStart)
  const db = drizzle

  const [deleted] = await db
    .delete(mtdSubmission)
    .where(
      and(
        eq(mtdSubmission.userId, userId),
        eq(mtdSubmission.quarterId, quarter.id),
        eq(mtdSubmission.taxYearStart, quarter.taxYearStart),
      ),
    )
    .returning()

  if (!deleted) {
    throw new Error('No submission found for this quarter')
  }

  return {
    quarterId: quarter.id,
    taxYearStart: quarter.taxYearStart,
  }
}
