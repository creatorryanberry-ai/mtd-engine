import { dateToIso } from '~/features/business/businessDateFormat'
import { parseAmountInput } from '~/features/bankAccounts/utils/manualTransaction'

export const CIS_VOUCHER_DESCRIPTION = 'CIS Voucher'
export const CIS_VOUCHER_DAY = 5

const MERCHANT_MEMO_SEPARATOR = ' — '
const CIS_VOUCHER_DETAILS_RE =
  /^CIS Voucher(?: \| G:(\d+(?:\.\d{1,2})?) T:(\d+(?:\.\d{1,2})?))?$/

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

export function toCisVoucherIsoDate(year: number, month: number) {
  const monthPad = String(month).padStart(2, '0')
  return `${year}-${monthPad}-${String(CIS_VOUCHER_DAY).padStart(2, '0')}`
}

export function getDefaultCisVoucherDate(from = new Date()) {
  const year = from.getFullYear()
  const month = from.getMonth() + 1
  const day = from.getDate()

  if (day >= CIS_VOUCHER_DAY) {
    return toCisVoucherIsoDate(year, month)
  }

  const previous = new Date(year, month - 2, CIS_VOUCHER_DAY)
  return dateToIso(previous)
}

export function isCisVoucherDate(isoDate: string) {
  return /^\d{4}-\d{2}-05$/.test(isoDate)
}

export function parseCisVoucherDate(isoDate: string) {
  if (!isCisVoucherDate(isoDate)) return null
  const [year, month] = isoDate.split('-').map(Number)
  return { year, month }
}

export function calculateCisVoucherNet(gross: number, tax: number) {
  return Math.round((gross - tax) * 100) / 100
}

export function parseCisVoucherAmounts(grossInput: string, taxInput: string) {
  const gross = parseAmountInput(grossInput)
  if (gross == null) return null

  const normalizedTax = taxInput.replace(/[£,\s]/g, '')
  if (!normalizedTax) return null

  const tax = Number.parseFloat(normalizedTax)
  if (!Number.isFinite(tax) || tax < 0) return null
  if (tax > gross) return null

  return {
    gross,
    tax,
    net: calculateCisVoucherNet(gross, tax),
  }
}

export function formatCisVoucherDetails(gross: number, tax: number) {
  return `${CIS_VOUCHER_DESCRIPTION} | G:${gross.toFixed(2)} T:${tax.toFixed(2)}`
}

export function isCisVoucherDetails(details: string | null | undefined) {
  if (!details) return false
  return CIS_VOUCHER_DETAILS_RE.test(details.trim())
}

export function parseCisVoucherDetails(details: string | null | undefined) {
  if (!details) return null
  const match = CIS_VOUCHER_DETAILS_RE.exec(details.trim())
  if (!match) return null

  if (!match[1] || !match[2]) {
    return { gross: null as number | null, tax: null as number | null }
  }

  return {
    gross: Number.parseFloat(match[1]),
    tax: Number.parseFloat(match[2]),
  }
}

export function isCisVoucherMerchant(merchant: string) {
  const { memo } = splitMerchant(merchant)
  return isCisVoucherDetails(memo)
}

export function getCisVoucherDisplayMemo(memo: string | null | undefined) {
  if (!memo) return null
  return isCisVoucherDetails(memo) ? CIS_VOUCHER_DESCRIPTION : memo
}

export function parseCisVoucherTransaction(transaction: {
  merchant: string
  amount: number
}) {
  const { name, memo } = splitMerchant(transaction.merchant)
  const details = parseCisVoucherDetails(memo)
  if (!details) return null

  const gross = details.gross ?? Math.abs(transaction.amount)
  const tax = details.tax ?? 0
  const net = calculateCisVoucherNet(gross, tax)

  return {
    customer: name,
    gross,
    tax,
    net,
  }
}

export function collectCisCustomers(transactions: { merchant: string }[]) {
  const customers = new Map<string, string>()

  for (const transaction of transactions) {
    if (!isCisVoucherMerchant(transaction.merchant)) continue
    const { name } = splitMerchant(transaction.merchant)
    const trimmed = name.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (!customers.has(key)) {
      customers.set(key, trimmed)
    }
  }

  return [...customers.values()].sort((left, right) => left.localeCompare(right))
}
