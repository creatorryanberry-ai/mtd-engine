import { eq, and, gte, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { mtdTransaction } from '~/database/schema'
import { server } from '~/env'
import {
  getFilteredTransactionsForUser,
  getFriendlyNameForMerchant,
  getPrivateUsePercentForMerchant,
  getRulesForUser,
} from '~/features/categorisation/server/categorisationService'
import { mapMtdTransactionDto } from '~/features/bankAccounts/utils/mapMtdTransactionDto'

import { getBankLinkItemsForUser } from './bankAccountService'
import { getTransactionWindowStartDate } from './transactionWindow'

import type { MtdTransactionDto } from '../types'
import type {
  TransactionFilter,
  TransactionSort,
} from '~/features/categorisation/server/categorisationService'

export type BankTransactionsResponse = {
  transactions: MtdTransactionDto[]
  total: number
  showing: number
  offset: number
  limit: number
}

export type { MtdTransactionDto }

export { getBankLinkItemForUser, getBankLinkItemsForUser } from './bankAccountService'

export async function getBankAccountsSummary(userId: string) {
  const items = await getBankLinkItemsForUser(userId)
  const db = drizzle
  const syncStartDate = getTransactionWindowStartDate()

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mtdTransaction)
    .where(
      and(eq(mtdTransaction.userId, userId), gte(mtdTransaction.date, syncStartDate)),
    )

  const lastSyncedAt = items.reduce<string | null>((latest, item) => {
    if (!item.lastSyncedAt) return latest
    if (!latest || item.lastSyncedAt > latest) return item.lastSyncedAt
    return latest
  }, null)

  return {
    lastSyncedAt,
    transactionCount: countResult[0]?.count ?? 0,
    syncWindowDays: Number(server.TRANSACTION_WINDOW_DAYS || 90),
  }
}

export async function getTransactionsForUser(
  userId: string,
  limit = 50,
  offset = 0,
  filter: TransactionFilter = 'all',
  sort: TransactionSort = 'newest',
  excludeReviewed = false,
  reviewedOnly = false,
  bankAccountId?: string,
) {
  const result = await getFilteredTransactionsForUser(userId, {
    limit,
    offset,
    filter,
    sort,
    excludeReviewed,
    reviewedOnly,
    bankAccountId,
  })

  const rules = await getRulesForUser(userId)
  const { resolveAttachmentUrlForClient } =
    await import('~/features/upload/receiptStorage')

  return {
    transactions: await Promise.all(
      result.rows.map(async (row) => {
        const friendlyName = getFriendlyNameForMerchant(
          rules,
          row.merchantName,
          row.bankAccountId,
        )
        const privateUsePercent = getPrivateUsePercentForMerchant(
          rules,
          row.merchantName,
          row.hmrcCategory,
          row.bankAccountId,
        )
        const attachmentUrl = await resolveAttachmentUrlForClient(
          row.attachmentUrl,
          userId,
        )
        return mapMtdTransactionDto(
          { ...row, attachmentUrl },
          {
            displayName: friendlyName ?? undefined,
            privateUsePercent,
          },
        )
      }),
    ),
    total: result.total,
    showing: result.showing,
    offset: result.offset,
    limit: result.limit,
  }
}
