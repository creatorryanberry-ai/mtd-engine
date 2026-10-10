import { and, eq, gte, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { bankAccount, mtdTransaction, bankLinkItem } from '~/database/schema'
import {
  sortBankAccounts,
  isSystemBankAccount,
  filterBankAccountsForContext,
  getDefaultBankAccountContext,
} from '~/features/bankAccounts/defaultBankAccounts'

import { getTransactionWindowStartDate } from '~/features/bankAccounts/server/transactionWindow'

import { ensureDefaultBankAccounts } from './ensureDefaultBankAccounts'

import type { InferSelectModel } from 'drizzle-orm'

export type BankAccountUpdateInput = {
  institutionName?: string | null
  accountName?: string | null
}

export type BankAccountRow = InferSelectModel<typeof bankAccount>

export type BankAccountWithStats = BankAccountRow & {
  transactionCount: number
  unreviewedCount: number
}

export async function getBankAccountById(userId: string, bankAccountId: string) {
  const db = drizzle
  const [row] = await db
    .select()
    .from(bankAccount)
    .where(and(eq(bankAccount.userId, userId), eq(bankAccount.id, bankAccountId)))
    .limit(1)
  return row ?? null
}

export async function updateBankAccount(
  userId: string,
  bankAccountId: string,
  input: BankAccountUpdateInput,
) {
  const db = drizzle
  const existing = await getBankAccountById(userId, bankAccountId)
  if (!existing) {
    throw new Error('Bank account not found')
  }

  if (isSystemBankAccount(existing.externalAccountId)) {
    throw new Error('Default bank accounts cannot be edited')
  }

  const now = new Date().toISOString()
  const [updated] = await db
    .update(bankAccount)
    .set({
      institutionName:
        input.institutionName !== undefined
          ? input.institutionName
          : existing.institutionName,
      accountName:
        input.accountName !== undefined ? input.accountName : existing.accountName,
      updatedAt: now,
    })
    .where(and(eq(bankAccount.userId, userId), eq(bankAccount.id, bankAccountId)))
    .returning()

  return updated!
}

export async function deleteBankAccount(userId: string, bankAccountId: string) {
  const db = drizzle
  const existing = await getBankAccountById(userId, bankAccountId)
  if (!existing) {
    throw new Error('Bank account not found')
  }

  if (isSystemBankAccount(existing.externalAccountId)) {
    throw new Error('Default bank accounts cannot be removed')
  }

  const bankLinkItemId = existing.bankLinkItemId

  const [transactionCountResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mtdTransaction)
    .where(
      and(
        eq(mtdTransaction.userId, userId),
        eq(mtdTransaction.bankAccountId, bankAccountId),
      ),
    )

  await db
    .delete(mtdTransaction)
    .where(
      and(
        eq(mtdTransaction.userId, userId),
        eq(mtdTransaction.bankAccountId, bankAccountId),
      ),
    )

  await db
    .delete(bankAccount)
    .where(and(eq(bankAccount.userId, userId), eq(bankAccount.id, bankAccountId)))

  const remainingAccounts = await db
    .select({ id: bankAccount.id })
    .from(bankAccount)
    .where(
      and(eq(bankAccount.userId, userId), eq(bankAccount.bankLinkItemId, bankLinkItemId)),
    )
    .limit(1)

  if (remainingAccounts.length === 0) {
    await db
      .delete(bankLinkItem)
      .where(and(eq(bankLinkItem.userId, userId), eq(bankLinkItem.id, bankLinkItemId)))
  }

  return {
    deleted: true,
    transactionCount: transactionCountResult?.count ?? 0,
  }
}

export async function getBankAccountsForUser(
  userId: string,
): Promise<BankAccountWithStats[]> {
  const db = drizzle
  const syncStartDate = getTransactionWindowStartDate()

  const { getBusinessSettings } = await import('~/features/api/server/businessSettings')
  const businessSettings = await getBusinessSettings(userId)
  const bankAccountContext = getDefaultBankAccountContext(businessSettings)
  await ensureDefaultBankAccounts(userId, bankAccountContext)

  const accounts = await db
    .select()
    .from(bankAccount)
    .where(eq(bankAccount.userId, userId))

  const visibleAccounts = filterBankAccountsForContext(accounts, bankAccountContext)

  const statsByAccount = await db
    .select({
      bankAccountId: mtdTransaction.bankAccountId,
      transactionCount: sql<number>`count(*)::int`,
      unreviewedCount: sql<number>`count(*) filter (where ${mtdTransaction.reviewedAt} is null)::int`,
      transactionBalance: sql<number>`coalesce(sum(${mtdTransaction.amount}), 0)::float8`,
    })
    .from(mtdTransaction)
    .where(
      and(
        eq(mtdTransaction.userId, userId),
        gte(mtdTransaction.date, syncStartDate),
        sql`${mtdTransaction.bankAccountId} is not null`,
      ),
    )
    .groupBy(mtdTransaction.bankAccountId)

  const statsMap = new Map(
    statsByAccount.map((row) => [
      row.bankAccountId,
      {
        transactionCount: row.transactionCount,
        unreviewedCount: row.unreviewedCount,
        transactionBalance: row.transactionBalance,
      },
    ]),
  )

  return sortBankAccounts(
    visibleAccounts.map((account) => {
      const stats = statsMap.get(account.id)
      const isSystem = isSystemBankAccount(account.externalAccountId)
      return {
        ...account,
        transactionCount: stats?.transactionCount ?? 0,
        unreviewedCount: stats?.unreviewedCount ?? 0,
        balance: isSystem ? (stats?.transactionBalance ?? 0) : account.balance,
      }
    }),
  )
}

export async function getBankLinkItemsForUser(userId: string) {
  const db = drizzle
  return db.select().from(bankLinkItem).where(eq(bankLinkItem.userId, userId))
}

export async function getBankLinkItemForUser(userId: string) {
  const items = await getBankLinkItemsForUser(userId)
  return items[0] ?? null
}
