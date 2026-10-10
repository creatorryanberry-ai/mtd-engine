import { and, eq, gte, isNotNull, lte } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { bankAccount, mileageEntry, mtdTransaction } from '~/database/schema'
import { getBusinessSettings } from '~/features/api/server/businessSettings'
import { getHmrcCategoryType } from '~/features/mtd/categories/hmrcCategories'
import {
  getTaxYearEnd,
  parseTaxYearStart,
  getTaxYearStart,
} from '~/features/mtd/utils/quarterPeriods'
import { enrichMileageEntriesWithClaims } from '~/features/mileage/utils/mileageClaim'
import { parseCisVoucherTransaction } from '~/features/bankAccounts/utils/cisVoucher'
import { parseLandlordStatementTransaction } from '~/features/bankAccounts/utils/landlordStatement'
import { SYSTEM_ACCOUNT_IDS } from '~/features/bankAccounts/defaultBankAccounts'
import { roundMoney } from '~/features/submission/reviewFinancialEstimates'
import type { TaxableBusinessProfit } from '~/features/taxEstimate/types'

const EXCLUDED_CATEGORIES = new Set(['transfer', 'personal', 'uncategorised'])

function daysBetweenInclusive(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T12:00:00`)
  const to = new Date(`${toIso}T12:00:00`)
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1)
}

function todayIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function getTaxableBusinessProfit(
  userId: string,
  taxYearStartInput: string,
  useProjection: boolean,
): Promise<TaxableBusinessProfit> {
  const taxYearStart = parseTaxYearStart(taxYearStartInput) ?? getTaxYearStart()
  const taxYearEnd = getTaxYearEnd(taxYearStart)
  const db = drizzle

  const [rows, accounts, settings, mileageRows] = await Promise.all([
    db
      .select()
      .from(mtdTransaction)
      .where(
        and(
          eq(mtdTransaction.userId, userId),
          gte(mtdTransaction.date, taxYearStart),
          lte(mtdTransaction.date, taxYearEnd),
          isNotNull(mtdTransaction.reviewedAt),
        ),
      ),
    db.select().from(bankAccount).where(eq(bankAccount.userId, userId)),
    getBusinessSettings(userId),
    db.select().from(mileageEntry).where(eq(mileageEntry.userId, userId)),
  ])

  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const isLandlord = settings?.businessType === 'landlord'

  let turnover = 0
  let expenses = 0
  let cisDeducted = 0
  let cisIncomplete = false
  let propertyGross = 0
  let propertyExpenses = 0

  for (const row of rows) {
    const cis = parseCisVoucherTransaction({
      merchant: row.merchantName,
      amount: row.amount,
    })
    if (cis) {
      cisDeducted += cis.tax
    }

    const landlord = parseLandlordStatementTransaction({
      merchant: row.merchantName,
      amount: row.amount,
    })
    if (landlord) {
      propertyGross += landlord.grossRents
      propertyExpenses += landlord.expenses + landlord.vatOnExpenses
      continue
    }

    const account = row.bankAccountId ? accountsById.get(row.bankAccountId) : null
    if (account?.externalAccountId === SYSTEM_ACCOUNT_IDS.landlord && !landlord) {
      if (row.amount > 0) propertyGross += row.amount
      else propertyExpenses += Math.abs(row.amount)
      continue
    }

    if (EXCLUDED_CATEGORIES.has(row.hmrcCategory)) continue
    const type = getHmrcCategoryType(row.hmrcCategory)
    if (type === 'income') turnover += row.amount
    else if (type === 'expense') expenses += Math.abs(row.amount)
  }

  if (settings?.vehicleClaimMethod === 'mileage') {
    const mileageWithClaims = enrichMileageEntriesWithClaims(mileageRows)
    expenses += mileageWithClaims
      .filter((entry) => entry.date >= taxYearStart && entry.date <= taxYearEnd)
      .reduce((total, entry) => total + entry.claim.claimPounds, 0)
  }

  turnover = roundMoney(turnover)
  expenses = roundMoney(expenses)
  cisDeducted = roundMoney(cisDeducted)
  propertyGross = roundMoney(propertyGross)
  propertyExpenses = roundMoney(propertyExpenses)
  const propertyProfit = roundMoney(Math.max(0, propertyGross - propertyExpenses))
  const recordedProfit = isLandlord ? 0 : roundMoney(turnover - expenses)

  const daysInYear = daysBetweenInclusive(taxYearStart, taxYearEnd)
  const clippedToday = todayIso() > taxYearEnd ? taxYearEnd : todayIso()
  const yearComplete = clippedToday >= taxYearEnd
  const daysElapsed = daysBetweenInclusive(taxYearStart, clippedToday)

  let projected: number | null = null
  if (!yearComplete && !isLandlord && daysElapsed >= 14 && recordedProfit !== 0) {
    projected = roundMoney((recordedProfit * daysInYear) / daysElapsed)
  }

  const profitUsed =
    useProjection && projected != null && !yearComplete ? projected : recordedProfit

  return {
    selfEmploymentRecordedProfitPounds: recordedProfit,
    selfEmploymentProjectedProfitPounds: projected,
    selfEmploymentTurnoverPounds: turnover,
    selfEmploymentExpensesPounds: expenses,
    yearComplete,
    daysElapsed,
    daysInYear,
    usingProjection: useProjection && projected != null && !yearComplete,
    profitUsedPounds: profitUsed,
    propertyGrossPounds: propertyGross,
    propertyExpensesPounds: propertyExpenses,
    propertyProfitPounds: propertyProfit,
    propertyFromRecords: propertyGross > 0 || propertyExpenses > 0,
    cisDeductedPounds: cisDeducted,
    cisIncomplete,
  }
}
