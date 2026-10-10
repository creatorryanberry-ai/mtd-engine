import { describe, expect, it } from 'vitest'

import { resolveMerchant } from '~/features/mtd/receipt/merchant'

describe('resolveMerchant', () => {
  it('resolves Lemon Squeezy from Bill from and ignores Need help / Bill to', () => {
    const text = `
Need help?
Invoice number:
5724131
Date of issue:
13 June 2025
Bill to:
Creator Scaffold Design
Fullerton House, Fullerton Road
Rotherham
Bill from:
Lemon Squeezy LLC
354 Oyster Point Blvd.
South San Francisco
CA, 94080
United States
VAT No: 432218330
Thanks for being a Lemon Squeezy customer
`

    const result = resolveMerchant({ text })
    expect(result.merchantRaw).toBe('Lemon Squeezy Llc')
    expect(result.merchantDisplay).toBe('Lemon Squeezy')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.merchantDisplay).not.toBe('Need Help?')
    expect(result.merchantRaw).not.toMatch(/Creator Scaffold/i)
    expect(result.evidence.some((item) => /Bill from|supplier label/i.test(item))).toBe(
      true,
    )
  })

  it('resolves supplier label with company suffix stripped for display', () => {
    const text = `
Supplier:
ABC Plumbing Ltd
14 High Street
Sheffield
VAT No: 123456789
`
    const result = resolveMerchant({ text })
    expect(result.merchantRaw).toBe('Abc Plumbing Ltd')
    expect(result.merchantDisplay).toBe('Abc Plumbing')
  })

  it('does not treat Bill To customer as merchant when From is present', () => {
    const text = `
Bill To:
Joe Bloggs Ltd

From:
Screwfix Direct Ltd
`
    const result = resolveMerchant({ text })
    expect(result.merchantDisplay).toBe('Screwfix')
    expect(result.merchantRaw).toMatch(/Screwfix Direct/i)
  })

  it('favours Tesco over receipt chrome on a generic receipt header', () => {
    const text = `
CUSTOMER COPY
NEED HELP?
THANK YOU

TESCO STORES 6247
123 High Street
London
TOTAL £24.50
`
    const result = resolveMerchant({ text, preferredType: 'receipt' })
    expect(result.merchantDisplay).toBe('Tesco')
    expect(result.merchantRaw?.toLowerCase()).toContain('tesco')
  })
})
