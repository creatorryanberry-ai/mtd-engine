import type { MtdTransactionDto } from '~/features/bankAccounts/types'
import {
  getCisVoucherDisplayMemo,
  isCisVoucherDetails,
} from '~/features/bankAccounts/utils/cisVoucher'
import {
  getLandlordStatementDisplayMemo,
  isLandlordStatementDetails,
} from '~/features/bankAccounts/utils/landlordStatement'

const MERCHANT_MEMO_SEPARATOR = ' — '

export function toTitleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

export function splitTransactionMerchant(merchant: string) {
  const separatorIndex = merchant.indexOf(MERCHANT_MEMO_SEPARATOR)
  if (separatorIndex === -1) {
    return { name: merchant, memo: null as string | null }
  }

  return {
    name: merchant.slice(0, separatorIndex).trim(),
    memo: merchant.slice(separatorIndex + MERCHANT_MEMO_SEPARATOR.length).trim() || null,
  }
}

export function formatTransactionDate(date: string) {
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return date
  return `${day}/${month}/${year}`
}

export function getTransactionDisplayName(merchant: string) {
  return toTitleCase(splitTransactionMerchant(merchant).name)
}

export type MtdTransactionGroup = {
  key: string
  transactions: MtdTransactionDto[]
}

export function sortTransactionsByNewest(transactions: MtdTransactionDto[]) {
  return [...transactions].sort((left, right) => right.date.localeCompare(left.date))
}

export function groupTransactionsByDisplayName(
  transactions: MtdTransactionDto[],
): MtdTransactionGroup[] {
  const groups: MtdTransactionGroup[] = []
  const groupByKey = new Map<string, MtdTransactionGroup>()

  for (const transaction of transactions) {
    const key = getTransactionGroupKey(transaction)
    const existing = groupByKey.get(key)

    if (existing) {
      existing.transactions.push(transaction)
      continue
    }

    const group = { key, transactions: [transaction] }
    groupByKey.set(key, group)
    groups.push(group)
  }

  for (const group of groups) {
    group.transactions = sortTransactionsByNewest(group.transactions)
  }

  return groups
}

export function isTransactionCategorised(hmrcCategory: string) {
  return hmrcCategory !== 'uncategorised'
}

export function getTransactionDisplayLines(transaction: {
  merchant: string
  displayName?: string
  category: string
  hmrcCategory?: string
  date: string
}) {
  const { name, memo } = splitTransactionMerchant(transaction.merchant)
  const displayName = transaction.displayName ?? toTitleCase(name)
  const categorised = isTransactionCategorised(
    transaction.hmrcCategory ?? 'uncategorised',
  )
  const displayMemo = isLandlordStatementDetails(memo)
    ? getLandlordStatementDisplayMemo(memo)
    : isCisVoucherDetails(memo)
      ? getCisVoucherDisplayMemo(memo)
      : memo

  return {
    name: displayName,
    memo: displayMemo ?? (categorised ? null : transaction.category),
    category: categorised ? transaction.category : null,
    date: formatTransactionDate(transaction.date),
  }
}

export function withoutRuleDisplayName<T extends { displayName?: string }>(
  transaction: T,
): T {
  if (!transaction.displayName) return transaction
  return { ...transaction, displayName: undefined }
}

export function getTransactionGroupKey(transaction: {
  merchant: string
  displayName?: string
}) {
  return transaction.displayName ?? getTransactionDisplayName(transaction.merchant)
}
