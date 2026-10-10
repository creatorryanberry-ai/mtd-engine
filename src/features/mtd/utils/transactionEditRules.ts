import {
  getMatchingRulesForMerchant as getMatchingRulesForMerchantFromRules,
  ruleMatchesMerchant as matchMerchantRule,
  type RuleMatchType,
} from '~/features/categorisation/categorisationMatching'
import { splitTransactionMerchant } from '~/features/mtd/utils/formatTransactionDisplay'

import type { CategorisationRuleDto } from '~/features/categorisation/client/useCategorisationRules'

export type TransactionRuleDraft = {
  clientId: string
  serverId?: string
  matchValue: string
  friendlyName: string
  hmrcCategory: string
  matchType: RuleMatchType
  privateUsePercent?: number | null
  deleted?: boolean
}

export function ruleMatchesMerchant(
  rule: Pick<CategorisationRuleDto, 'matchType' | 'matchValue'>,
  merchantName: string,
) {
  return matchMerchantRule(rule, merchantName)
}

export function getMatchingRulesForMerchant(
  rules: CategorisationRuleDto[],
  merchantName: string,
  bankAccountId?: string | null,
) {
  return getMatchingRulesForMerchantFromRules(rules, merchantName, bankAccountId)
}

export function getDefaultMatchValue(merchant: string) {
  return splitTransactionMerchant(merchant).name.trim()
}

export function createDefaultRuleDraft(
  merchant: string,
  hmrcCategory = 'uncategorised',
): TransactionRuleDraft {
  return {
    clientId: crypto.randomUUID(),
    matchValue: getDefaultMatchValue(merchant),
    friendlyName: '',
    hmrcCategory,
    matchType: 'contains',
    privateUsePercent: null,
  }
}

export function ruleDtoToDraft(rule: CategorisationRuleDto): TransactionRuleDraft {
  return {
    clientId: rule.id,
    serverId: rule.id,
    matchValue: rule.matchValue,
    friendlyName: rule.friendlyName ?? '',
    hmrcCategory: rule.hmrcCategory,
    matchType: rule.matchType as RuleMatchType,
    privateUsePercent: rule.privateUsePercent,
  }
}

export function buildInitialRuleDrafts(
  merchant: string,
  rules: CategorisationRuleDto[],
  hmrcCategory = 'uncategorised',
  bankAccountId?: string | null,
) {
  const matching = getMatchingRulesForMerchant(rules, merchant, bankAccountId)
  if (matching.length > 0) {
    return matching.map(ruleDtoToDraft)
  }

  return [createDefaultRuleDraft(merchant, hmrcCategory)]
}

export function getPrimaryRuleDraft(drafts: TransactionRuleDraft[]) {
  return drafts.find((draft) => !draft.deleted)
}

export function getPrimaryFriendlyName(drafts: TransactionRuleDraft[]) {
  return getPrimaryRuleDraft(drafts)?.friendlyName ?? ''
}
