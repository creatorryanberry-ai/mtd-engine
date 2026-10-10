import { and, eq, gte, isNotNull, lte } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { bankAccount, mileageEntry, mtdTransaction } from '~/database/schema'
import { getBusinessSettings } from '~/features/api/server/businessSettings'
import { getRulesForUser } from '~/features/categorisation/server/categorisationService'
import { getHmrcCategoryType } from '~/features/mtd/categories/hmrcCategories'
import { supportsPrivateUse } from '~/features/mtd/categories/transactionEditCategories'
import { splitTransactionMerchant } from '~/features/mtd/utils/formatTransactionDisplay'
import {
  getQuarterInfo,
  getTaxYearStart,
  parseQuarterId,
  parseTaxYearStart,
} from '~/features/mtd/utils/quarterPeriods'
import { getActiveQuarter } from '~/features/mtd/utils/quarterStatus'
import { enrichMileageEntriesWithClaims } from '~/features/mileage/utils/mileageClaim'
import { parseCisVoucherTransaction } from '~/features/bankAccounts/utils/cisVoucher'
import {
  estimateClass4NationalInsurance,
  estimateTaxDue,
  roundMoney,
  type ReviewCisVoucherSummary,
  type ReviewFinancialSummary,
  type ReviewPeriodTransaction,
  type ReviewPrivateUseItem,
} from '~/features/submission/reviewFinancialEstimates'

export type { ReviewFinancialSummary }

const EXCLUDED_CATEGORIES = new Set(['transfer', 'personal', 'uncategorised'])

function formatAccountLabel(
  account: {
    institutionName: string | null
    accountName: string | null
  } | null,
) {
  if (!account) return 'Account'
  const bankName = account.institutionName?.trim()
  const accountName = account.accountName?.trim()
  if (bankName && accountName) return `${bankName}, ${accountName}`
  return bankName || accountName || 'Account'
}

function buildPrivateUseItems(
  rules: Awaited<ReturnType<typeof getRulesForUser>>,
): ReviewPrivateUseItem[] {
  const items: ReviewPrivateUseItem[] = []
  const seen = new Set<string>()

  for (const rule of rules) {
    if (
      !supportsPrivateUse(rule.hmrcCategory) ||
      rule.privateUsePercent == null ||
      rule.privateUsePercent < 1 ||
      rule.privateUsePercent > 99
    ) {
      continue
    }

    const label = (rule.friendlyName?.trim() || rule.matchValue.trim()).trim()
    if (!label) continue

    const key = `${label.toLowerCase()}:${rule.privateUsePercent}`
    if (seen.has(key)) continue
    seen.add(key)

    items.push({
      label,
      percent: rule.privateUsePercent,
    })
  }

  return items.sort((left, right) => left.label.localeCompare(right.label))
}

export async function getReviewFinancialSummary(
  userId: string,
  options?: { quarterId?: string | null; taxYearStart?: string | null },
): Promise<ReviewFinancialSummary> {
  const taxYearStart =
    parseTaxYearStart(options?.taxYearStart ?? undefined) ?? getTaxYearStart()
  const quarterId = parseQuarterId(options?.quarterId ?? undefined)
  const quarter = quarterId
    ? getQuarterInfo(quarterId, taxYearStart)
    : getActiveQuarter({ taxYearStart })
  const db = drizzle

  const [rows, accounts, settings, rules, mileageRows] = await Promise.all([
    db
      .select()
      .from(mtdTransaction)
      .where(
        and(
          eq(mtdTransaction.userId, userId),
          gte(mtdTransaction.date, quarter.taxYearStart),
          lte(mtdTransaction.date, quarter.periodEnd),
          isNotNull(mtdTransaction.reviewedAt),
        ),
      ),
    db.select().from(bankAccount).where(eq(bankAccount.userId, userId)),
    getBusinessSettings(userId),
    getRulesForUser(userId),
    db.select().from(mileageEntry).where(eq(mileageEntry.userId, userId)),
  ])

  const accountsById = new Map(accounts.map((account) => [account.id, account]))

  let income = 0
  let expenses = 0
  let cisTaxPaid = 0
  const cisVouchers: ReviewCisVoucherSummary[] = []
  const incomeTransactions: ReviewPeriodTransaction[] = []
  const expenseTransactions: ReviewPeriodTransaction[] = []

  for (const row of rows) {
    const cis = parseCisVoucherTransaction({
      merchant: row.merchantName,
      amount: row.amount,
    })
    if (cis) {
      cisTaxPaid += cis.tax
      cisVouchers.push({
        id: row.id,
        customer: cis.customer,
        gross: roundMoney(cis.gross),
        tax: roundMoney(cis.tax),
      })
    }

    if (EXCLUDED_CATEGORIES.has(row.hmrcCategory)) continue

    const type = getHmrcCategoryType(row.hmrcCategory)
    if (type === 'income') {
      income += row.amount

      // CIS is reviewed on its own step — omit from income already-recorded list
      if (!cis) {
        const linkedAccount = row.bankAccountId
          ? (accountsById.get(row.bankAccountId) ?? null)
          : null
        const { name } = splitTransactionMerchant(row.merchantName)
        incomeTransactions.push({
          id: row.id,
          label: name.trim() || row.merchantName,
          accountLabel: linkedAccount
            ? formatAccountLabel(linkedAccount)
            : row.accountName?.trim() || 'Account',
          amount: roundMoney(row.amount),
        })
      }
    } else if (type === 'expense') {
      expenses += Math.abs(row.amount)

      const linkedAccount = row.bankAccountId
        ? (accountsById.get(row.bankAccountId) ?? null)
        : null
      const { name } = splitTransactionMerchant(row.merchantName)
      expenseTransactions.push({
        id: row.id,
        label: name.trim() || row.merchantName,
        accountLabel: linkedAccount
          ? formatAccountLabel(linkedAccount)
          : row.accountName?.trim() || 'Account',
        amount: roundMoney(Math.abs(row.amount)),
      })
    }
  }

  income = roundMoney(income)
  expenses = roundMoney(expenses)
  const profit = roundMoney(income - expenses)
  cisTaxPaid = roundMoney(cisTaxPaid)

  const showCisStep = settings?.cisRegistered === true
  const showCisTax = showCisStep || cisTaxPaid > 0
  const showMileageStep = settings?.vehicleClaimMethod === 'mileage'

  const mileageWithClaims = enrichMileageEntriesWithClaims(mileageRows)
  const quarterMileage = mileageWithClaims.filter(
    (entry) => entry.date >= quarter.periodStart && entry.date <= quarter.periodEnd,
  )
  const milesThisQuarter = quarterMileage.reduce((total, entry) => total + entry.miles, 0)
  const claimPoundsThisQuarter = roundMoney(
    quarterMileage.reduce((total, entry) => total + entry.claim.claimPounds, 0),
  )
  const mileageTransactions: ReviewPeriodTransaction[] = quarterMileage
    .map((entry) => ({
      id: entry.id,
      label: entry.journeyDetails.trim() || 'Mileage',
      accountLabel: `${entry.miles.toLocaleString('en-GB')} mi`,
      amount: roundMoney(entry.claim.claimPounds),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))

  const taxYearStartYear = Number(quarter.taxYearStart.slice(0, 4))

  return {
    income,
    expenses,
    profit,
    estimatedTax: estimateTaxDue(profit),
    estimatedNationalInsurance: estimateClass4NationalInsurance(profit),
    cisTaxPaid,
    showCisTax,
    showCisStep,
    showMileageStep,
    cisVouchers: cisVouchers.sort((left, right) =>
      left.customer.localeCompare(right.customer),
    ),
    incomeTransactions: incomeTransactions.sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
    expenseTransactions: expenseTransactions.sort((left, right) =>
      left.label.localeCompare(right.label),
    ),
    mileageTransactions,
    privateUseItems: buildPrivateUseItems(rules),
    mileage: showMileageStep
      ? {
          milesThisQuarter,
          claimPoundsThisQuarter,
        }
      : null,
    quarterLabel: quarter.label,
    taxYearLabel: `${taxYearStartYear}/${String(taxYearStartYear + 1).slice(2)}`,
  }
}
