import { describe, expect, it } from 'vitest'

import { sortRulesAlphabetically } from '~/features/categorisation/sortRules'

describe('sortRulesAlphabetically', () => {
  it('sorts by friendly name when present, otherwise match value', () => {
    const sorted = sortRulesAlphabetically([
      {
        friendlyName: 'Zebra Supplies',
        matchValue: 'ZEBRA',
      },
      {
        friendlyName: null,
        matchValue: 'amazon',
      },
      {
        friendlyName: 'PayPal',
        matchValue: 'PAYPAL',
      },
    ])

    expect(sorted.map((rule) => rule.friendlyName ?? rule.matchValue)).toEqual([
      'amazon',
      'PayPal',
      'Zebra Supplies',
    ])
  })
})
