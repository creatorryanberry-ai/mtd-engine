import { getHmrcCategoryType } from '~/features/mtd/categories/hmrcCategories'
import { normalizeRulePrivateUsePercent } from '~/features/mtd/categories/transactionEditCategories'
import { needsReview } from '~/features/categorisation/categorisationUtils'
import { getTransactionDisplayName } from '~/features/mtd/utils/formatTransactionDisplay'
import {
  getMerchantColor,
  getMerchantInitials,
} from '~/features/bankAccounts/server/transactionMapper'
import { isManualTransaction } from '~/features/bankAccounts/utils/manualTransaction'

import type { MtdTransactionDto } from '../types'

function formatDisplayDate(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export type MtdTransactionRow = {
  id: string
  externalTransactionId: string
  merchantName: string
  category: string
  hmrcCategory: string
  categorySource: string
  confidence: string
  reviewedAt: string | number | null
  date: string
  amount: number
  pending: boolean
  attachmentUrl?: string | null
}

export function mapMtdTransactionDto(
  row: MtdTransactionRow,
  options?: { displayName?: string; privateUsePercent?: number | null },
): MtdTransactionDto {
  const merchant = row.merchantName
  const categorySource = row.categorySource as MtdTransactionDto['categorySource']
  const displayName = options?.displayName ?? getTransactionDisplayName(merchant)
  const labelForAvatar = displayName
  const privateUsePercent = normalizeRulePrivateUsePercent(
    row.hmrcCategory,
    options?.privateUsePercent,
  )

  return {
    id: row.id,
    merchant,
    displayName,
    category: row.category,
    hmrcCategory: row.hmrcCategory,
    categorySource,
    confidence: row.confidence as MtdTransactionDto['confidence'],
    needsReview: needsReview(row.confidence, row.reviewedAt),
    categoryType: getHmrcCategoryType(row.hmrcCategory),
    date: formatDisplayDate(row.date),
    dateIso: row.date,
    amount: row.amount,
    initials: getMerchantInitials(labelForAvatar),
    color: getMerchantColor(labelForAvatar),
    pending: row.pending,
    isManual: isManualTransaction(row.externalTransactionId),
    privateUsePercent,
    attachmentUrl: row.attachmentUrl ?? null,
  }
}
