import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  categorisationRule,
  categorisationRuleBankAccount,
  mtdTransaction,
} from '~/database/schema'
import { getHmrcCategoryLabel } from '~/features/mtd/categories/hmrcCategories'
import { normalizeRulePrivateUsePercent } from '~/features/mtd/categories/transactionEditCategories'
import { getTransactionWindowStartDate } from '~/features/bankAccounts/server/transactionWindow'

import type { RuleMatchType } from '~/features/categorisation/categorisationMatching'
import {
  ruleAppliesToBankAccount,
  ruleMatchesMerchant,
} from '~/features/categorisation/categorisationMatching'

export type CategorySource = 'rule' | 'heuristic' | 'user' | 'uncategorised'
export type CategoryConfidence = 'high' | 'low'

export type CategorisationResult = {
  hmrcCategory: string
  category: string
  categorySource: CategorySource
  confidence: CategoryConfidence
}

export type CategorisationRuleRow = typeof categorisationRule.$inferSelect

export type CategorisationRuleWithAccounts = CategorisationRuleRow & {
  bankAccountIds: string[]
}

export type CategorisationStats = {
  total: number
  categorised: number
  toReview: number
  progress: number
}

export type TransactionFilter = 'to-review' | 'all' | 'income' | 'expenses' | 'transfers'
export type TransactionSort = 'newest' | 'oldest'

function ruleMatches(rule: CategorisationRuleRow, merchantName: string) {
  return ruleMatchesMerchant(rule, merchantName)
}

export {
  getFriendlyNameForMerchant,
  getMatchingRulesForMerchant,
  getPrivateUsePercentForMerchant,
} from '~/features/categorisation/categorisationMatching'

export async function getRulesForUser(
  userId: string,
): Promise<CategorisationRuleWithAccounts[]> {
  const db = drizzle
  const rules = await db
    .select()
    .from(categorisationRule)
    .where(eq(categorisationRule.userId, userId))
    .orderBy(asc(categorisationRule.priority), asc(categorisationRule.createdAt))

  if (rules.length === 0) return []

  const ruleIds = rules.map((rule) => rule.id)
  const links = await db
    .select()
    .from(categorisationRuleBankAccount)
    .where(inArray(categorisationRuleBankAccount.ruleId, ruleIds))

  const bankAccountIdsByRule = new Map<string, string[]>()
  for (const link of links) {
    const existing = bankAccountIdsByRule.get(link.ruleId) ?? []
    existing.push(link.bankAccountId)
    bankAccountIdsByRule.set(link.ruleId, existing)
  }

  return rules.map((rule) => ({
    ...rule,
    bankAccountIds: bankAccountIdsByRule.get(rule.id) ?? [],
  }))
}

async function setRuleBankAccounts(ruleId: string, bankAccountIds: string[]) {
  const db = drizzle
  const uniqueIds = [...new Set(bankAccountIds)]

  await db
    .delete(categorisationRuleBankAccount)
    .where(eq(categorisationRuleBankAccount.ruleId, ruleId))

  if (uniqueIds.length === 0) return

  await db.insert(categorisationRuleBankAccount).values(
    uniqueIds.map((bankAccountId) => ({
      ruleId,
      bankAccountId,
    })),
  )
}

export function applyRuleToMerchant(
  rules: CategorisationRuleWithAccounts[],
  merchantName: string,
  bankAccountId?: string | null,
): CategorisationResult | null {
  for (const rule of rules) {
    if (rule.matchField !== 'merchant') continue
    if (!ruleMatches(rule, merchantName)) continue
    if (!ruleAppliesToBankAccount(rule, bankAccountId)) continue

    return {
      hmrcCategory: rule.hmrcCategory,
      category: getHmrcCategoryLabel(rule.hmrcCategory),
      categorySource: 'rule',
      confidence: 'high',
    }
  }

  return null
}

export async function getCategorisationStats(
  userId: string,
  bankAccountId?: string,
): Promise<CategorisationStats> {
  if (!bankAccountId) {
    const { getBankAccountsForUser } =
      await import('~/features/bankAccounts/server/bankAccountService')
    const accounts = await getBankAccountsForUser(userId)

    const total = accounts.reduce((sum, account) => sum + account.transactionCount, 0)
    const toReview = accounts.reduce((sum, account) => sum + account.unreviewedCount, 0)
    const categorised = total - toReview
    const progress = total > 0 ? Math.round((categorised / total) * 100) : 0

    return { total, categorised, toReview, progress }
  }

  const db = drizzle
  const syncStartDate = getTransactionWindowStartDate()

  const [result] = await db
    .select({
      total: sql<number>`count(*)::int`,
      toReview: sql<number>`count(*) filter (where ${mtdTransaction.reviewedAt} is null)::int`,
    })
    .from(mtdTransaction)
    .where(
      and(
        eq(mtdTransaction.userId, userId),
        gte(mtdTransaction.date, syncStartDate),
        eq(mtdTransaction.bankAccountId, bankAccountId),
      ),
    )

  const total = result?.total ?? 0
  const toReview = result?.toReview ?? 0
  const categorised = total - toReview
  const progress = total > 0 ? Math.round((categorised / total) * 100) : 0

  return { total, categorised, toReview, progress }
}

export async function getFilterCounts(
  userId: string,
  unreviewedOnly = false,
  bankAccountId?: string,
) {
  const db = drizzle
  const syncStartDate = getTransactionWindowStartDate()

  const accountFilter = bankAccountId
    ? eq(mtdTransaction.bankAccountId, bankAccountId)
    : undefined

  const baseWhere = unreviewedOnly
    ? and(
        eq(mtdTransaction.userId, userId),
        gte(mtdTransaction.date, syncStartDate),
        isNull(mtdTransaction.reviewedAt),
        accountFilter,
      )
    : and(
        eq(mtdTransaction.userId, userId),
        gte(mtdTransaction.date, syncStartDate),
        accountFilter,
      )

  const [counts] = await db
    .select({
      toReview: sql<number>`count(*) filter (where ${mtdTransaction.confidence} = 'low' and ${mtdTransaction.reviewedAt} is null)::int`,
      all: sql<number>`count(*)::int`,
      income: sql<number>`count(*) filter (where ${mtdTransaction.hmrcCategory} in ('turnover', 'other_business_income'))::int`,
      expenses: sql<number>`count(*) filter (where ${mtdTransaction.hmrcCategory} not in ('turnover', 'other_business_income', 'transfer', 'personal', 'uncategorised'))::int`,
      transfers: sql<number>`count(*) filter (where ${mtdTransaction.hmrcCategory} = 'transfer')::int`,
    })
    .from(mtdTransaction)
    .where(baseWhere)

  return {
    'to-review': counts?.toReview ?? 0,
    all: counts?.all ?? 0,
    income: counts?.income ?? 0,
    expenses: counts?.expenses ?? 0,
    transfers: counts?.transfers ?? 0,
  }
}

function buildFilterCondition(
  filter: TransactionFilter,
  {
    excludeReviewed = false,
    reviewedOnly = false,
  }: {
    excludeReviewed?: boolean
    reviewedOnly?: boolean
  } = {},
) {
  let condition

  switch (filter) {
    case 'to-review':
      condition = and(
        eq(mtdTransaction.confidence, 'low'),
        isNull(mtdTransaction.reviewedAt),
      )
      break
    case 'income':
      condition = or(
        eq(mtdTransaction.hmrcCategory, 'turnover'),
        eq(mtdTransaction.hmrcCategory, 'other_business_income'),
      )
      break
    case 'expenses':
      condition = sql`${mtdTransaction.hmrcCategory} not in ('turnover', 'other_business_income', 'transfer', 'personal', 'uncategorised')`
      break
    case 'transfers':
      condition = eq(mtdTransaction.hmrcCategory, 'transfer')
      break
    case 'all':
      condition = undefined
      break
  }

  if (reviewedOnly) {
    const reviewed = isNotNull(mtdTransaction.reviewedAt)
    condition = condition ? and(condition, reviewed) : reviewed
  } else if (excludeReviewed) {
    const unreviewed = isNull(mtdTransaction.reviewedAt)
    condition = condition ? and(condition, unreviewed) : unreviewed
  }

  return condition
}

export async function getFilteredTransactionsForUser(
  userId: string,
  {
    limit = 50,
    offset = 0,
    filter = 'to-review',
    sort = 'newest',
    excludeReviewed = false,
    reviewedOnly = false,
    bankAccountId,
  }: {
    limit?: number
    offset?: number
    filter?: TransactionFilter
    sort?: TransactionSort
    excludeReviewed?: boolean
    reviewedOnly?: boolean
    bankAccountId?: string
  },
) {
  const db = drizzle
  const syncStartDate = getTransactionWindowStartDate()
  const filterCondition = buildFilterCondition(filter, { excludeReviewed, reviewedOnly })
  const accountFilter = bankAccountId
    ? eq(mtdTransaction.bankAccountId, bankAccountId)
    : undefined

  // manual/cis/landlord aren't bank-synced — don't hide them behind the bank sync window
  let applySyncWindow = true
  if (bankAccountId) {
    const { getBankAccountById } =
      await import('~/features/bankAccounts/server/bankAccountService')
    const { isSystemBankAccount } =
      await import('~/features/bankAccounts/defaultBankAccounts')
    const account = await getBankAccountById(userId, bankAccountId)
    if (account && isSystemBankAccount(account.externalAccountId)) {
      applySyncWindow = false
    }
  }

  const dateFilter = applySyncWindow ? gte(mtdTransaction.date, syncStartDate) : undefined

  const whereClause = filterCondition
    ? and(eq(mtdTransaction.userId, userId), dateFilter, filterCondition, accountFilter)
    : and(eq(mtdTransaction.userId, userId), dateFilter, accountFilter)

  const rows = await db
    .select()
    .from(mtdTransaction)
    .where(whereClause)
    .orderBy(
      sort === 'oldest' ? asc(mtdTransaction.date) : desc(mtdTransaction.date),
      sort === 'oldest' ? asc(mtdTransaction.createdAt) : desc(mtdTransaction.createdAt),
    )
    .limit(limit)
    .offset(offset)

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mtdTransaction)
    .where(whereClause)

  return {
    rows,
    total: countResult?.count ?? 0,
    showing: rows.length,
    offset,
    limit,
  }
}

export async function updateTransactionCategory(
  userId: string,
  transactionId: string,
  hmrcCategory: string,
) {
  const db = drizzle
  const now = new Date().toISOString()

  const [updated] = await db
    .update(mtdTransaction)
    .set({
      hmrcCategory,
      category: getHmrcCategoryLabel(hmrcCategory),
      categorySource: 'user',
      confidence: 'high',
      reviewedAt: now,
    })
    .where(and(eq(mtdTransaction.id, transactionId), eq(mtdTransaction.userId, userId)))
    .returning()

  return updated ?? null
}

export async function approveTransaction(userId: string, transactionId: string) {
  const db = drizzle
  const now = new Date().toISOString()

  const [updated] = await db
    .update(mtdTransaction)
    .set({
      reviewedAt: now,
      confidence: 'high',
    })
    .where(and(eq(mtdTransaction.id, transactionId), eq(mtdTransaction.userId, userId)))
    .returning()

  return updated ?? null
}

export async function createCategorisationRule(
  userId: string,
  input: {
    matchValue: string
    hmrcCategory: string
    friendlyName?: string | null
    matchType?: RuleMatchType
    priority?: number
    bankAccountIds?: string[]
    privateUsePercent?: number | null
  },
) {
  const db = drizzle
  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const friendlyName = input.friendlyName?.trim() || null
  const privateUsePercent = normalizeRulePrivateUsePercent(
    input.hmrcCategory,
    input.privateUsePercent,
  )

  const [rule] = await db
    .insert(categorisationRule)
    .values({
      id,
      userId,
      matchField: 'merchant',
      matchType: input.matchType ?? 'contains',
      matchValue: input.matchValue.trim(),
      friendlyName,
      hmrcCategory: input.hmrcCategory,
      privateUsePercent,
      priority: input.priority ?? 0,
      createdAt: now,
    })
    .returning()

  if (input.bankAccountIds) {
    await setRuleBankAccounts(id, input.bankAccountIds)
  }

  await reapplyRulesToUnreviewedTransactions(userId)

  const rules = await getRulesForUser(userId)
  return (
    rules.find((row) => row.id === id) ?? {
      ...rule!,
      bankAccountIds: input.bankAccountIds ?? [],
    }
  )
}

export async function updateCategorisationRule(
  userId: string,
  ruleId: string,
  input: {
    matchValue?: string
    hmrcCategory?: string
    friendlyName?: string | null
    matchType?: RuleMatchType
    priority?: number
    bankAccountIds?: string[]
    privateUsePercent?: number | null
  },
) {
  const db = drizzle

  const updates: Partial<typeof categorisationRule.$inferInsert> = {}
  const existingRules = await getRulesForUser(userId)
  const existingRule = existingRules.find((rule) => rule.id === ruleId)
  const nextHmrcCategory = input.hmrcCategory ?? existingRule?.hmrcCategory

  if (input.matchValue !== undefined) {
    updates.matchValue = input.matchValue.trim()
  }
  if (input.hmrcCategory !== undefined) {
    updates.hmrcCategory = input.hmrcCategory
  }
  if (input.friendlyName !== undefined) {
    updates.friendlyName = input.friendlyName?.trim() || null
  }
  if (input.matchType !== undefined) {
    updates.matchType = input.matchType
  }
  if (input.priority !== undefined) {
    updates.priority = input.priority
  }
  if (input.privateUsePercent !== undefined && nextHmrcCategory) {
    updates.privateUsePercent = normalizeRulePrivateUsePercent(
      nextHmrcCategory,
      input.privateUsePercent,
    )
  } else if (input.hmrcCategory !== undefined && nextHmrcCategory) {
    updates.privateUsePercent = normalizeRulePrivateUsePercent(
      nextHmrcCategory,
      existingRule?.privateUsePercent,
    )
  }

  if (Object.keys(updates).length === 0 && input.bankAccountIds === undefined) {
    const rules = await getRulesForUser(userId)
    return rules.find((rule) => rule.id === ruleId) ?? null
  }

  let updated: CategorisationRuleRow | undefined

  if (Object.keys(updates).length > 0) {
    ;[updated] = await db
      .update(categorisationRule)
      .set(updates)
      .where(
        and(eq(categorisationRule.id, ruleId), eq(categorisationRule.userId, userId)),
      )
      .returning()
  }

  if (input.bankAccountIds !== undefined) {
    await setRuleBankAccounts(ruleId, input.bankAccountIds)
  }

  if (updated || input.bankAccountIds !== undefined) {
    await reapplyRulesToUnreviewedTransactions(userId)
  }

  const rules = await getRulesForUser(userId)
  return rules.find((rule) => rule.id === ruleId) ?? null
}

export async function upsertRuleForMerchant(
  userId: string,
  input: {
    matchValue: string
    hmrcCategory: string
    friendlyName?: string | null
    matchType?: RuleMatchType
    priority?: number
    bankAccountIds?: string[]
    privateUsePercent?: number | null
  },
) {
  const rules = await getRulesForUser(userId)
  const matchValue = input.matchValue.trim()
  const existing = rules.find(
    (rule) => rule.matchValue.toLowerCase() === matchValue.toLowerCase(),
  )

  if (existing) {
    return updateCategorisationRule(userId, existing.id, {
      matchValue: input.matchValue,
      hmrcCategory: input.hmrcCategory,
      friendlyName: input.friendlyName,
      matchType: input.matchType,
      priority: input.priority,
      bankAccountIds: input.bankAccountIds,
      privateUsePercent: input.privateUsePercent,
    })
  }

  return createCategorisationRule(userId, input)
}

export async function deleteCategorisationRule(userId: string, ruleId: string) {
  const db = drizzle

  const [deleted] = await db
    .delete(categorisationRule)
    .where(and(eq(categorisationRule.id, ruleId), eq(categorisationRule.userId, userId)))
    .returning()

  if (deleted) {
    await reapplyRulesToUnreviewedTransactions(userId)
  }

  return deleted ?? null
}

export async function clearCategorisationRulesForUser(userId: string) {
  const db = drizzle
  const rules = await getRulesForUser(userId)

  if (rules.length === 0) {
    return { count: 0 }
  }

  await db.delete(categorisationRule).where(eq(categorisationRule.userId, userId))

  const syncStartDate = getTransactionWindowStartDate()
  await db
    .update(mtdTransaction)
    .set({
      hmrcCategory: 'uncategorised',
      category: 'Uncategorised',
      categorySource: 'uncategorised',
      confidence: 'low',
    })
    .where(
      and(
        eq(mtdTransaction.userId, userId),
        gte(mtdTransaction.date, syncStartDate),
        isNull(mtdTransaction.reviewedAt),
        eq(mtdTransaction.categorySource, 'rule'),
      ),
    )

  return { count: rules.length }
}

export async function reapplyRulesToUnreviewedTransactions(userId: string) {
  const db = drizzle
  const rules = await getRulesForUser(userId)
  const syncStartDate = getTransactionWindowStartDate()

  const rows = await db
    .select()
    .from(mtdTransaction)
    .where(
      and(
        eq(mtdTransaction.userId, userId),
        gte(mtdTransaction.date, syncStartDate),
        isNull(mtdTransaction.reviewedAt),
        sql`${mtdTransaction.categorySource} != 'user'`,
      ),
    )

  for (const row of rows) {
    const ruleMatch = applyRuleToMerchant(rules, row.merchantName, row.bankAccountId)
    if (ruleMatch) {
      await db
        .update(mtdTransaction)
        .set({
          hmrcCategory: ruleMatch.hmrcCategory,
          category: ruleMatch.category,
          categorySource: ruleMatch.categorySource,
          confidence: ruleMatch.confidence,
        })
        .where(eq(mtdTransaction.id, row.id))
    }
  }
}
