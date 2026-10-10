import { supportsPrivateUse } from '~/features/mtd/categories/transactionEditCategories'

export type RuleMatchType = 'contains' | 'starts_with' | 'exact'

export type CategorisationRuleMatch = {
  matchField: string
  matchType: string
  matchValue: string
  friendlyName?: string | null
  hmrcCategory: string
  privateUsePercent?: number | null
  priority: number
  createdAt: string
  bankAccountIds?: string[]
}

export function ruleAppliesToBankAccount(
  rule: { bankAccountIds?: string[] },
  bankAccountId?: string | null,
) {
  const accountIds = rule.bankAccountIds
  if (!accountIds || accountIds.length === 0) return true
  if (!bankAccountId) return false
  return accountIds.includes(bankAccountId)
}

export function ruleMatchesMerchant(
  rule: Pick<CategorisationRuleMatch, 'matchType' | 'matchValue'>,
  merchantName: string,
) {
  const merchant = merchantName.toLowerCase()
  const value = rule.matchValue.toLowerCase()

  if (rule.matchType === 'exact') {
    return merchant === value
  }

  if (rule.matchType === 'starts_with') {
    return merchant.startsWith(value)
  }

  return merchant.includes(value)
}

export function getMatchingRulesForMerchant<T extends CategorisationRuleMatch>(
  rules: T[],
  merchantName: string,
  bankAccountId?: string | null,
) {
  return rules.filter(
    (rule) =>
      rule.matchField === 'merchant' &&
      ruleMatchesMerchant(rule, merchantName) &&
      ruleAppliesToBankAccount(rule, bankAccountId),
  )
}

export function getFriendlyNameForMerchant<T extends CategorisationRuleMatch>(
  rules: T[],
  merchantName: string,
  bankAccountId?: string | null,
) {
  const ordered = getOrderedMerchantRules(rules)

  for (const rule of ordered) {
    if (rule.matchField !== 'merchant') continue
    if (!ruleMatchesMerchant(rule, merchantName)) continue
    if (!ruleAppliesToBankAccount(rule, bankAccountId)) continue
    if (rule.friendlyName?.trim()) return rule.friendlyName.trim()
  }

  return null
}

function getOrderedMerchantRules<T extends CategorisationRuleMatch>(rules: T[]) {
  return [...rules].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority
    }

    return left.createdAt.localeCompare(right.createdAt)
  })
}

export function getPrivateUsePercentForMerchant<T extends CategorisationRuleMatch>(
  rules: T[],
  merchantName: string,
  hmrcCategory: string,
  bankAccountId?: string | null,
) {
  if (!supportsPrivateUse(hmrcCategory)) return null

  for (const rule of getOrderedMerchantRules(rules)) {
    if (rule.matchField !== 'merchant') continue
    if (!ruleMatchesMerchant(rule, merchantName)) continue
    if (!ruleAppliesToBankAccount(rule, bankAccountId)) continue
    if (
      rule.privateUsePercent == null ||
      rule.privateUsePercent < 1 ||
      rule.privateUsePercent > 99
    ) {
      continue
    }

    return rule.privateUsePercent
  }

  return null
}
