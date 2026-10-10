import {
  getHmrcCategoryForEditCategory,
  type TransactionEditCategoryId,
} from '~/features/mtd/categories/transactionEditCategories'
import { splitTransactionMerchant } from '~/features/mtd/utils/formatTransactionDisplay'

export const MANUAL_TRANSACTION_ID_PREFIX = 'manual:'

export function isManualTransaction(externalTransactionId: string) {
  return externalTransactionId.startsWith(MANUAL_TRANSACTION_ID_PREFIX)
}

export function joinMerchantName(name: string, details?: string | null) {
  const trimmedName = name.trim()
  const trimmedDetails = details?.trim()
  if (!trimmedDetails) return trimmedName
  return `${trimmedName} — ${trimmedDetails}`
}

export function parseManualTransactionFields(merchantName: string) {
  return splitTransactionMerchant(merchantName)
}

export function getSignedAmountForCategory(
  amount: number,
  categoryId: TransactionEditCategoryId | null,
) {
  const absolute = Math.abs(amount)
  if (categoryId === 'income') return absolute
  return -absolute
}

export function getSignedAmountForHmrcCategory(amount: number, hmrcCategory: string) {
  if (hmrcCategory === 'turnover' || hmrcCategory === 'other_business_income') {
    return Math.abs(amount)
  }
  return -Math.abs(amount)
}

export function parseAmountInput(value: string) {
  const normalized = value.replace(/[£$€,\s]/g, '')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

export function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function createManualExternalTransactionId() {
  return `${MANUAL_TRANSACTION_ID_PREFIX}${crypto.randomUUID()}`
}

export function getHmrcCategoryAmountSign(hmrcCategory: string) {
  return getSignedAmountForHmrcCategory(1, hmrcCategory)
}

export function getCategoryAmountSign(categoryId: TransactionEditCategoryId | null) {
  return getSignedAmountForCategory(1, categoryId)
}

export function formatAmountInputValue(amount: number) {
  return Math.abs(amount).toFixed(2)
}

export function getDefaultManualCategoryId(): TransactionEditCategoryId | null {
  return null
}

export function resolveManualAmountSign(
  categoryId: TransactionEditCategoryId | null,
  hmrcCategory?: string,
) {
  if (categoryId) {
    return getCategoryAmountSign(categoryId)
  }
  if (hmrcCategory) {
    return getHmrcCategoryAmountSign(hmrcCategory)
  }
  return -1
}

export function getHmrcCategoryFromEditCategory(categoryId: TransactionEditCategoryId) {
  return getHmrcCategoryForEditCategory(categoryId)
}
