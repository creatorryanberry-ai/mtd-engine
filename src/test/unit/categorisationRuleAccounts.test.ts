import { describe, expect, it } from 'vitest'

import {
  getMatchingRulesForMerchant,
  ruleAppliesToBankAccount,
} from '~/features/categorisation/categorisationMatching'

describe('categorisation rule account scoping', () => {
  const rule = {
    matchField: 'merchant',
    matchType: 'contains',
    matchValue: 'TESCO',
    friendlyName: null,
    hmrcCategory: 'other_business_expenses',
    priority: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    bankAccountIds: ['account-a'],
  }

  it('applies legacy rules without account ids to every account', () => {
    expect(ruleAppliesToBankAccount({ bankAccountIds: [] }, 'account-a')).toBe(true)
    expect(ruleAppliesToBankAccount({}, 'account-b')).toBe(true)
  })

  it('only matches scoped rules on selected accounts', () => {
    expect(ruleAppliesToBankAccount(rule, 'account-a')).toBe(true)
    expect(ruleAppliesToBankAccount(rule, 'account-b')).toBe(false)
    expect(getMatchingRulesForMerchant([rule], 'TESCO STORE', 'account-b')).toHaveLength(
      0,
    )
    expect(getMatchingRulesForMerchant([rule], 'TESCO STORE', 'account-a')).toHaveLength(
      1,
    )
  })
})
