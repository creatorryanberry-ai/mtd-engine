import { describe, expect, it } from 'vitest'

import { ruleMatchesMerchant } from '~/features/categorisation/categorisationMatching'

describe('ruleMatchesMerchant', () => {
  it('matches contains rules case-insensitively', () => {
    expect(
      ruleMatchesMerchant(
        { matchType: 'contains', matchValue: 'paypal' },
        'PAYPAL PAYMENT — ABC',
      ),
    ).toBe(true)
  })

  it('matches starts_with rules case-insensitively', () => {
    expect(
      ruleMatchesMerchant(
        { matchType: 'starts_with', matchValue: 'paypal' },
        'PAYPAL PAYMENT — ABC',
      ),
    ).toBe(true)
    expect(
      ruleMatchesMerchant(
        { matchType: 'starts_with', matchValue: 'payment' },
        'PAYPAL PAYMENT — ABC',
      ),
    ).toBe(false)
  })
})
