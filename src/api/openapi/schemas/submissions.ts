import * as v from 'valibot'

const quarterIdSchema = v.picklist(['Q1', 'Q2', 'Q3', 'Q4'])

export const quarterInfoSchema = v.object({
  id: quarterIdSchema,
  label: v.string(),
  taxYearStart: v.string(),
  periodStart: v.string(),
  periodEnd: v.string(),
  deadline: v.string(),
  periodLabel: v.string(),
  deadlineLabel: v.string(),
  hmrcUpdatePeriodLabel: v.string(),
})

const submissionCategoryLineSchema = v.object({
  id: v.string(),
  label: v.string(),
  hmrcBox: v.optional(v.number()),
  total: v.number(),
  type: v.picklist(['income', 'expense']),
})

const submissionBlockerSchema = v.object({
  id: v.string(),
  message: v.string(),
})

const existingSubmissionSchema = v.object({
  reference: v.string(),
  submittedAt: v.string(),
  incomeTotal: v.number(),
  expenseTotal: v.number(),
  taxableProfit: v.number(),
  taxDue: v.number(),
  source: v.picklist(['mock', 'hmrc']),
})

export const quarterlySummarySchema = v.object({
  quarter: quarterInfoSchema,
  categoryLines: v.array(submissionCategoryLineSchema),
  incomeTotal: v.number(),
  expenseTotal: v.number(),
  taxableProfit: v.number(),
  transactionCount: v.number(),
  toReview: v.number(),
  uncategorised: v.number(),
  blockers: v.array(submissionBlockerSchema),
  isReady: v.boolean(),
  existingSubmission: v.nullable(existingSubmissionSchema),
})

export const submitQuarterlyResultSchema = v.object({
  status: v.literal('ACCEPTED'),
  reference: v.string(),
  submittedAt: v.string(),
  incomeTotal: v.number(),
  expenseTotal: v.number(),
  taxableProfit: v.number(),
  taxDue: v.number(),
  source: v.picklist(['mock', 'hmrc']),
  hmrcPeriodId: v.optional(v.nullable(v.string())),
})

const reviewCisVoucherSummarySchema = v.object({
  id: v.string(),
  customer: v.string(),
  gross: v.number(),
  tax: v.number(),
})

const reviewPeriodTransactionSchema = v.object({
  id: v.string(),
  label: v.string(),
  accountLabel: v.string(),
  amount: v.number(),
})

export const reviewFinancialSummarySchema = v.object({
  income: v.number(),
  expenses: v.number(),
  profit: v.number(),
  estimatedTax: v.number(),
  estimatedNationalInsurance: v.number(),
  cisTaxPaid: v.number(),
  showCisTax: v.boolean(),
  showCisStep: v.boolean(),
  showMileageStep: v.boolean(),
  cisVouchers: v.array(reviewCisVoucherSummarySchema),
  incomeTransactions: v.array(reviewPeriodTransactionSchema),
  expenseTransactions: v.array(reviewPeriodTransactionSchema),
  mileageTransactions: v.array(reviewPeriodTransactionSchema),
  privateUseItems: v.array(
    v.object({
      label: v.string(),
      percent: v.number(),
    }),
  ),
  mileage: v.nullable(
    v.object({
      milesThisQuarter: v.number(),
      claimPoundsThisQuarter: v.number(),
    }),
  ),
  quarterLabel: v.string(),
  taxYearLabel: v.string(),
})

export const submissionsOverviewSchema = v.object({
  taxYear: v.object({
    start: v.string(),
    end: v.string(),
    label: v.string(),
  }),
  activeQuarterId: quarterIdSchema,
  quarters: v.array(
    v.object({
      quarterId: quarterIdSchema,
      label: v.string(),
      periodLabel: v.string(),
      hmrcUpdatePeriodLabel: v.string(),
      deadlineLabel: v.string(),
      status: v.string(),
      statusLabel: v.string(),
      incomeTotal: v.number(),
      expenseTotal: v.number(),
      taxableProfit: v.number(),
      isReady: v.boolean(),
      toReview: v.number(),
      submittedAt: v.nullable(v.string()),
      reference: v.nullable(v.string()),
    }),
  ),
  yearEnd: v.object({
    status: v.string(),
    taxYearLabel: v.string(),
    periodLabel: v.string(),
    finalDeclarationDeadline: v.string(),
    finalDeclarationDeadlineLabel: v.string(),
  }),
})
