import { dateToIso } from '~/features/business/businessDateFormat'
import { parseAmountInput } from '~/features/bankAccounts/utils/manualTransaction'

export const LANDLORD_STATEMENT_DESCRIPTION = 'Landlord Statement'

const MERCHANT_MEMO_SEPARATOR = ' — '
const LANDLORD_STATEMENT_DETAILS_RE =
  /^Landlord Statement(?: \| G:(\d+(?:\.\d{1,2})?) E:(\d+(?:\.\d{1,2})?) V:(\d+(?:\.\d{1,2})?))?$/

function splitMerchant(merchant: string) {
  const separatorIndex = merchant.indexOf(MERCHANT_MEMO_SEPARATOR)
  if (separatorIndex === -1) {
    return { name: merchant, memo: null as string | null }
  }

  return {
    name: merchant.slice(0, separatorIndex).trim(),
    memo: merchant.slice(separatorIndex + MERCHANT_MEMO_SEPARATOR.length).trim() || null,
  }
}

function parseOptionalAmount(value: string) {
  const normalized = value.replace(/[£,\s]/g, '')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function getDefaultMonthEndDate(from = new Date()) {
  return dateToIso(new Date(from.getFullYear(), from.getMonth(), 0))
}

export function calculateLandlordStatementNet(
  grossRents: number,
  expenses: number,
  vatOnExpenses: number,
) {
  return Math.round((grossRents - expenses - vatOnExpenses) * 100) / 100
}

export function parseLandlordStatementAmounts(
  grossInput: string,
  expensesInput: string,
  vatInput: string,
) {
  const grossRents = parseAmountInput(grossInput)
  if (grossRents == null) return null

  const expenses = expensesInput.trim() ? parseOptionalAmount(expensesInput) : 0
  const vatOnExpenses = vatInput.trim() ? parseOptionalAmount(vatInput) : 0
  if (expenses == null || vatOnExpenses == null) return null

  const costs = expenses + vatOnExpenses
  if (costs > grossRents) return null

  return {
    grossRents,
    expenses,
    vatOnExpenses,
    netReceived: calculateLandlordStatementNet(grossRents, expenses, vatOnExpenses),
  }
}

export function formatLandlordStatementDetails(
  grossRents: number,
  expenses: number,
  vatOnExpenses: number,
) {
  return `${LANDLORD_STATEMENT_DESCRIPTION} | G:${grossRents.toFixed(2)} E:${expenses.toFixed(2)} V:${vatOnExpenses.toFixed(2)}`
}

export function isLandlordStatementDetails(details: string | null | undefined) {
  if (!details) return false
  return LANDLORD_STATEMENT_DETAILS_RE.test(details.trim())
}

export function parseLandlordStatementDetails(details: string | null | undefined) {
  if (!details) return null
  const match = LANDLORD_STATEMENT_DETAILS_RE.exec(details.trim())
  if (!match) return null

  if (!match[1] || !match[2] || !match[3]) {
    return {
      grossRents: null as number | null,
      expenses: null as number | null,
      vatOnExpenses: null as number | null,
    }
  }

  return {
    grossRents: Number.parseFloat(match[1]),
    expenses: Number.parseFloat(match[2]),
    vatOnExpenses: Number.parseFloat(match[3]),
  }
}

export function isLandlordStatementMerchant(merchant: string) {
  const { memo } = splitMerchant(merchant)
  return isLandlordStatementDetails(memo)
}

export function getLandlordStatementDisplayMemo(memo: string | null | undefined) {
  if (!memo) return null
  return isLandlordStatementDetails(memo) ? LANDLORD_STATEMENT_DESCRIPTION : memo
}

export function parseLandlordStatementTransaction(transaction: {
  merchant: string
  amount: number
}) {
  const { name, memo } = splitMerchant(transaction.merchant)
  const details = parseLandlordStatementDetails(memo)
  if (!details) return null

  const grossRents = details.grossRents ?? Math.abs(transaction.amount)
  const expenses = details.expenses ?? 0
  const vatOnExpenses = details.vatOnExpenses ?? 0

  return {
    lettingAgent: name,
    grossRents,
    expenses,
    vatOnExpenses,
    netReceived: calculateLandlordStatementNet(grossRents, expenses, vatOnExpenses),
  }
}

export function collectLettingAgents(transactions: { merchant: string }[]) {
  const agents = new Map<string, string>()

  for (const transaction of transactions) {
    if (!isLandlordStatementMerchant(transaction.merchant)) continue
    const { name } = splitMerchant(transaction.merchant)
    const trimmed = name.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!agents.has(key)) {
      agents.set(key, trimmed)
    }
  }

  return [...agents.values()].sort((left, right) => left.localeCompare(right))
}
