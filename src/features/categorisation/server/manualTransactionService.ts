import { and, eq, isNull } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { mtdTransaction } from '~/database/schema'
import { getHmrcCategoryLabel } from '~/features/mtd/categories/hmrcCategories'
import {
  createManualExternalTransactionId,
  isManualTransaction,
  isValidIsoDate,
  joinMerchantName,
} from '~/features/bankAccounts/utils/manualTransaction'
import { isCisVoucherMerchant } from '~/features/bankAccounts/utils/cisVoucher'
import { isLandlordStatementMerchant } from '~/features/bankAccounts/utils/landlordStatement'
import { getBankAccountById } from '~/features/bankAccounts/server/bankAccountService'
import { normalizeAttachmentForStorage } from '~/features/upload/receiptRef'

export type ManualTransactionInput = {
  bankAccountId: string
  name: string
  details?: string | null
  date: string
  amount: number
  attachmentUrl?: string | null
  hmrcCategory?: string
}

function validateManualInput(input: ManualTransactionInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Name is required')
  }
  if (!isValidIsoDate(input.date)) {
    throw new Error('Date must be YYYY-MM-DD')
  }
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new Error('Amount must be a non-zero number')
  }
}

export async function createManualTransaction(
  userId: string,
  input: ManualTransactionInput,
) {
  validateManualInput(input)

  const account = await getBankAccountById(userId, input.bankAccountId)
  if (!account) {
    throw new Error('Bank account not found')
  }

  const db = drizzle
  const merchantName = joinMerchantName(input.name, input.details)
  const hmrcCategory = input.hmrcCategory?.trim() || 'uncategorised'
  const now = new Date().toISOString()
  const reviewedAt = hmrcCategory === 'uncategorised' ? null : now

  const [created] = await db
    .insert(mtdTransaction)
    .values({
      id: crypto.randomUUID(),
      userId,
      externalTransactionId: createManualExternalTransactionId(),
      merchantName,
      category: getHmrcCategoryLabel(hmrcCategory),
      hmrcCategory,
      categorySource: 'user',
      confidence: hmrcCategory === 'uncategorised' ? 'low' : 'high',
      reviewedAt,
      amount: input.amount,
      date: input.date,
      pending: false,
      accountName: account.accountName ?? account.institutionName,
      attachmentUrl: normalizeAttachmentForStorage(input.attachmentUrl, null),
      bankAccountId: input.bankAccountId,
      createdAt: now,
    })
    .returning()

  return created!
}

export async function updateManualTransaction(
  userId: string,
  transactionId: string,
  input: Omit<ManualTransactionInput, 'bankAccountId'> & { bankAccountId?: string },
) {
  validateManualInput({
    bankAccountId: input.bankAccountId ?? '',
    name: input.name,
    details: input.details,
    date: input.date,
    amount: input.amount,
  })

  const db = drizzle
  const [existing] = await db
    .select()
    .from(mtdTransaction)
    .where(and(eq(mtdTransaction.id, transactionId), eq(mtdTransaction.userId, userId)))
    .limit(1)

  if (!existing) {
    return null
  }

  if (!isManualTransaction(existing.externalTransactionId)) {
    throw new Error('Only manual transactions can be edited')
  }

  const canEditWhenAccepted =
    isCisVoucherMerchant(existing.merchantName) ||
    isLandlordStatementMerchant(existing.merchantName) ||
    isManualTransaction(existing.externalTransactionId)
  if (existing.reviewedAt != null && !canEditWhenAccepted) {
    throw new Error('Accepted manual transactions cannot be edited')
  }

  const merchantName = joinMerchantName(input.name, input.details)
  const conditions = [
    eq(mtdTransaction.id, transactionId),
    eq(mtdTransaction.userId, userId),
  ]
  if (!canEditWhenAccepted) {
    conditions.push(isNull(mtdTransaction.reviewedAt))
  }

  const [updated] = await db
    .update(mtdTransaction)
    .set({
      merchantName,
      amount: input.amount,
      date: input.date,
      attachmentUrl: normalizeAttachmentForStorage(
        input.attachmentUrl,
        existing.attachmentUrl,
      ),
    })
    .where(and(...conditions))
    .returning()

  return updated ?? null
}

export async function getManualTransaction(userId: string, transactionId: string) {
  const db = drizzle
  const [row] = await db
    .select()
    .from(mtdTransaction)
    .where(and(eq(mtdTransaction.id, transactionId), eq(mtdTransaction.userId, userId)))
    .limit(1)

  if (!row || !isManualTransaction(row.externalTransactionId)) {
    return null
  }

  return row
}

export async function deleteManualTransaction(userId: string, transactionId: string) {
  const db = drizzle
  const [existing] = await db
    .select()
    .from(mtdTransaction)
    .where(and(eq(mtdTransaction.id, transactionId), eq(mtdTransaction.userId, userId)))
    .limit(1)

  if (!existing) {
    return null
  }

  if (!isManualTransaction(existing.externalTransactionId)) {
    throw new Error('Only manual transactions can be deleted')
  }

  const [deleted] = await db
    .delete(mtdTransaction)
    .where(and(eq(mtdTransaction.id, transactionId), eq(mtdTransaction.userId, userId)))
    .returning()

  return deleted ?? null
}

export function getManualTransactionCategoryLabel(hmrcCategory: string) {
  return getHmrcCategoryLabel(hmrcCategory)
}
