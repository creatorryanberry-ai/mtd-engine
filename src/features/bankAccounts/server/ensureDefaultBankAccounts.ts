import { and, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { bankAccount, bankLinkItem } from '~/database/schema'
import {
  DEFAULT_BANK_ACCOUNT_DEFINITIONS,
  getRequiredSystemAccountIds,
  type DefaultBankAccountContext,
  type SystemAccountId,
} from '~/features/bankAccounts/defaultBankAccounts'

import { encryptSecret } from '~/server/encryption'

function getSystemExternalItemId(userId: string) {
  return `system-${userId}`
}

async function ensureSystemBankLinkItem(userId: string) {
  const db = drizzle
  const now = new Date().toISOString()
  const externalItemId = getSystemExternalItemId(userId)

  const [existing] = await db
    .select()
    .from(bankLinkItem)
    .where(eq(bankLinkItem.externalItemId, externalItemId))
    .limit(1)

  if (existing) {
    return existing
  }

  const [created] = await db
    .insert(bankLinkItem)
    .values({
      id: crypto.randomUUID(),
      userId,
      externalItemId,
      accessToken: encryptSecret('system-default-accounts'),
      institutionName: 'MTD',
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return created!
}

async function ensureSystemBankAccount(
  userId: string,
  bankLinkItemRowId: string,
  externalAccountId: SystemAccountId,
) {
  const db = drizzle
  const now = new Date().toISOString()
  const definition = DEFAULT_BANK_ACCOUNT_DEFINITIONS[externalAccountId]

  const [existing] = await db
    .select()
    .from(bankAccount)
    .where(
      and(
        eq(bankAccount.userId, userId),
        eq(bankAccount.externalAccountId, externalAccountId),
      ),
    )
    .limit(1)

  if (existing) {
    return existing
  }

  const [created] = await db
    .insert(bankAccount)
    .values({
      id: crypto.randomUUID(),
      userId,
      bankLinkItemId: bankLinkItemRowId,
      externalAccountId,
      institutionName: definition.institutionName,
      accountName: definition.accountName,
      accountType: 'system',
      currency: 'GBP',
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return created!
}

export async function ensureDefaultBankAccounts(
  userId: string,
  context?: DefaultBankAccountContext,
) {
  const item = await ensureSystemBankLinkItem(userId)
  const requiredAccountIds = getRequiredSystemAccountIds(context)

  for (const externalAccountId of requiredAccountIds) {
    await ensureSystemBankAccount(userId, item.id, externalAccountId)
  }
}
