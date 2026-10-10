import { describe, expect, it } from 'vitest'

import {
  buildRuleDraftsForAccept,
  buildTransactionAcceptIds,
} from '~/features/mtd/utils/persistTransactionRuleDrafts'

describe('persistTransactionRuleDrafts', () => {
  it('updates the primary draft with friendly name and selected category', () => {
    const drafts = buildRuleDraftsForAccept({
      friendlyName: 'PayPal',
      hmrcCategory: 'turnover',
      ruleDrafts: [
        {
          clientId: 'draft-1',
          matchValue: 'PAYPAL PAYMENT',
          friendlyName: '',
          hmrcCategory: 'uncategorised',
          matchType: 'contains',
        },
        {
          clientId: 'draft-2',
          matchValue: 'PAYPAL',
          friendlyName: 'Other',
          hmrcCategory: 'personal',
          matchType: 'contains',
        },
      ],
    })

    expect(drafts[0]).toMatchObject({
      matchValue: 'PAYPAL PAYMENT',
      friendlyName: 'PayPal',
      hmrcCategory: 'turnover',
    })
    expect(drafts[1]).toMatchObject({
      matchValue: 'PAYPAL',
      hmrcCategory: 'personal',
    })
  })

  it('stores private use on business expense rules', () => {
    const drafts = buildRuleDraftsForAccept({
      friendlyName: 'Office',
      hmrcCategory: 'other_business_expenses',
      privateUsePercent: 50,
      ruleDrafts: [
        {
          clientId: 'draft-1',
          matchValue: 'AMAZON',
          friendlyName: '',
          hmrcCategory: 'uncategorised',
          matchType: 'contains',
        },
      ],
    })

    expect(drafts[0]).toMatchObject({
      hmrcCategory: 'other_business_expenses',
      privateUsePercent: 50,
    })
  })

  it('stores private use on shared-cost hmrc categories', () => {
    const drafts = buildRuleDraftsForAccept({
      friendlyName: 'EE',
      hmrcCategory: 'office_costs',
      privateUsePercent: 50,
      ruleDrafts: [
        {
          clientId: 'draft-1',
          matchValue: 'EE MOBILE',
          friendlyName: '',
          hmrcCategory: 'uncategorised',
          matchType: 'contains',
        },
      ],
    })

    expect(drafts[0]).toMatchObject({
      hmrcCategory: 'office_costs',
      privateUsePercent: 50,
    })
  })

  it('clears private use for non-business categories', () => {
    const drafts = buildRuleDraftsForAccept({
      friendlyName: 'PayPal',
      hmrcCategory: 'turnover',
      privateUsePercent: 50,
      ruleDrafts: [
        {
          clientId: 'draft-1',
          matchValue: 'PAYPAL',
          friendlyName: '',
          hmrcCategory: 'uncategorised',
          matchType: 'contains',
          privateUsePercent: 50,
        },
      ],
    })

    expect(drafts[0]?.privateUsePercent).toBeNull()
  })

  it('skips deleted and empty match rows', () => {
    const drafts = buildRuleDraftsForAccept({
      friendlyName: 'PayPal',
      hmrcCategory: 'turnover',
      ruleDrafts: [
        {
          clientId: 'draft-1',
          matchValue: '   ',
          friendlyName: '',
          hmrcCategory: 'uncategorised',
          matchType: 'contains',
          deleted: true,
        },
      ],
    })

    expect(drafts).toHaveLength(0)
  })

  it('always accepts the lead transaction and selected matched records', () => {
    expect(
      buildTransactionAcceptIds('lead', ['match-1', 'match-2'], new Set(['match-2'])),
    ).toEqual(['lead', 'match-2'])

    expect(buildTransactionAcceptIds('lead', ['match-1', 'match-2'], new Set())).toEqual([
      'lead',
    ])
  })
})
