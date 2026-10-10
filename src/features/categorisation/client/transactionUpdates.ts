import {
  getHmrcCategoryLabel,
  getHmrcCategoryType,
} from '~/features/mtd/categories/hmrcCategories'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'

export function buildReviewedTransaction(
  transaction: MtdTransactionDto,
): MtdTransactionDto {
  return {
    ...transaction,
    confidence: 'high',
    needsReview: false,
  }
}

export function buildCategorisedTransaction(
  transaction: MtdTransactionDto,
  hmrcCategory: string,
): MtdTransactionDto {
  return {
    ...transaction,
    hmrcCategory,
    category: getHmrcCategoryLabel(hmrcCategory),
    categorySource: 'user',
    confidence: 'high',
    needsReview: false,
    categoryType: getHmrcCategoryType(hmrcCategory),
  }
}
