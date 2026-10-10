import { describe, expect, it } from 'vitest'

import {
  getFriendlyNameForMerchant,
  getMatchingRulesForMerchant,
  getPrivateUsePercentForMerchant,
} from '~/features/categorisation/categorisationMatching'

describe('categorisationMatching', () => {
  it('returns matching rules for a merchant', () => {
    const rules = [
      {
        matchField: 'merchant',
        matchType: 'contains',
        matchValue: 'PAYPAL',
        friendlyName: null,
        hmrcCategory: 'other_business_expenses',
        priority: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        matchField: 'merchant',
        matchType: 'contains',
        matchValue: 'TESCO',
        friendlyName: null,
        hmrcCategory: 'other_business_expenses',
        priority: 0,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]

    expect(getMatchingRulesForMerchant(rules, 'PAYPAL PAYMENT — ABC')).toHaveLength(1)
    expect(
      getMatchingRulesForMerchant(rules, 'PAYPAL PAYMENT — ABC')[0]?.matchValue,
    ).toBe('PAYPAL')
  })

  it('returns the first matching friendly name by priority order', () => {
    const rules = [
      {
        matchField: 'merchant',
        matchType: 'contains',
        matchValue: 'PAYPAL',
        friendlyName: 'PayPal',
        hmrcCategory: 'other_business_expenses',
        priority: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        matchField: 'merchant',
        matchType: 'contains',
        matchValue: 'PAYMENT',
        friendlyName: 'Payment',
        hmrcCategory: 'other_business_expenses',
        priority: 0,
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]

    expect(getFriendlyNameForMerchant(rules, 'PAYPAL PAYMENT')).toBe('Payment')
  })

  it('returns null when no friendly name is set', () => {
    const rules = [
      {
        matchField: 'merchant',
        matchType: 'contains',
        matchValue: 'PAYPAL',
        friendlyName: null,
        hmrcCategory: 'other_business_expenses',
        priority: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]

    expect(getFriendlyNameForMerchant(rules, 'PAYPAL PAYMENT')).toBeNull()
  })

  it('returns private use percent from the first matching business expense rule', () => {
    const rules = [
      {
        matchField: 'merchant',
        matchType: 'contains',
        matchValue: 'PAYPAL',
        friendlyName: null,
        hmrcCategory: 'other_business_expenses',
        privateUsePercent: 50,
        priority: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]

    expect(
      getPrivateUsePercentForMerchant(rules, 'PAYPAL PAYMENT', 'other_business_expenses'),
    ).toBe(50)
    expect(getPrivateUsePercentForMerchant(rules, 'PAYPAL PAYMENT', 'office_costs')).toBe(
      50,
    )
    expect(
      getPrivateUsePercentForMerchant(rules, 'PAYPAL PAYMENT', 'turnover'),
    ).toBeNull()
  })
})
