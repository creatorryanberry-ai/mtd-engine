import { describe, expect, it } from 'vitest'

import {
  buildInitialRuleDrafts,
  createDefaultRuleDraft,
  getMatchingRulesForMerchant,
  ruleDtoToDraft,
} from '~/features/mtd/utils/transactionEditRules'

import type { CategorisationRuleDto } from '~/features/categorisation/client/useCategorisationRules'

function sampleRuleDto(
  overrides: Partial<CategorisationRuleDto> &
    Pick<CategorisationRuleDto, 'id' | 'matchValue'>,
): CategorisationRuleDto {
  return {
    matchField: 'merchant',
    matchType: 'contains',
    friendlyName: null,
    hmrcCategory: 'other_business_expenses',
    hmrcCategoryLabel: 'Other business expenses',
    privateUsePercent: null,
    bankAccountIds: [],
    priority: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('transactionEditRules', () => {
  it('creates a default draft from the merchant name part', () => {
    expect(createDefaultRuleDraft('PAYPAL PAYMENT — ABC', 'turnover')).toEqual({
      clientId: expect.any(String),
      matchValue: 'PAYPAL PAYMENT',
      friendlyName: '',
      hmrcCategory: 'turnover',
      matchType: 'contains',
      privateUsePercent: null,
    })
  })

  it('builds drafts from matching rules when present', () => {
    const rules = [
      sampleRuleDto({
        id: 'rule-1',
        matchValue: 'PAYPAL',
        friendlyName: 'PayPal',
      }),
    ]

    const drafts = buildInitialRuleDrafts('PAYPAL PAYMENT — ABC', rules)
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      serverId: 'rule-1',
      matchValue: 'PAYPAL',
      friendlyName: 'PayPal',
    })
  })

  it('maps rule dto to editable draft', () => {
    expect(
      ruleDtoToDraft(
        sampleRuleDto({
          id: 'rule-1',
          matchValue: 'TESCO',
          friendlyName: 'Groceries',
        }),
      ),
    ).toMatchObject({
      clientId: 'rule-1',
      serverId: 'rule-1',
      matchValue: 'TESCO',
      friendlyName: 'Groceries',
    })
  })

  it('maps rule dto private use into editable draft', () => {
    expect(
      ruleDtoToDraft(
        sampleRuleDto({
          id: 'rule-1',
          matchValue: 'TESCO',
          privateUsePercent: 50,
        }),
      ),
    ).toMatchObject({
      privateUsePercent: 50,
    })
  })

  it('filters matching rules on the client', () => {
    const rules = [
      sampleRuleDto({ id: '1', matchValue: 'PAYPAL' }),
      sampleRuleDto({ id: '2', matchValue: 'TESCO' }),
    ]

    expect(getMatchingRulesForMerchant(rules, 'PAYPAL PAYMENT — X')).toHaveLength(1)
  })
})
