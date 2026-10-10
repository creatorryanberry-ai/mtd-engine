import { describe, expect, it } from 'vitest'

import {
  extractDocumentFingerprints,
  pickBestFingerprintSignal,
} from '~/features/mtd/receipt/merchant/extractDocumentFingerprints'
import {
  matchPrivateUsePercentForDocument,
  matchProcessKindForDocument,
} from '~/features/mtd/receipt/merchant/matchFingerprint'
import { resolveMerchant } from '~/features/mtd/receipt/merchant/resolveMerchant'

const lemonOcr = `
Need help?
Invoice number:
5724131
Bill to:
Creator Scaffold Design
Fullerton House
Rotherham
S60 1DH
Tel: 0114 361 0060
Bill from:
Lemon Squeezy LLC
354 Oyster Point Blvd.
South San Francisco
CA, 94080
United States
VAT No: 432218330
Thanks for being a Lemon Squeezy customer
`

describe('extractDocumentFingerprints', () => {
  it('extracts supplier vat and ignores bill-to phone/postcode in supplier scope', () => {
    const signals = extractDocumentFingerprints(lemonOcr, {
      scope: 'supplier',
      strongOnly: true,
    })

    expect(
      signals.some((item) => item.type === 'vat' && item.value === '432218330'),
    ).toBe(true)
    expect(signals.some((item) => item.type === 'phone')).toBe(false)
    expect(
      signals.some((item) => item.type === 'postcode' && item.value === 's601dh'),
    ).toBe(false)
  })
})

describe('pickBestFingerprintSignal', () => {
  it('keeps a single strongest signal for one correction', () => {
    expect(
      pickBestFingerprintSignal([
        { type: 'ocr_raw_norm', value: 'need help' },
        { type: 'vat', value: '432218330' },
        { type: 'domain', value: 'lemonsqueezy.com' },
      ]),
    ).toEqual({ type: 'vat', value: '432218330' })
  })
})

describe('resolveMerchant with user fingerprints', () => {
  it('applies an OCR name correction when the same mangled candidate reappears', () => {
    const text = `
& Temporary Works Consultants
14 High Street
Rotherham
S60 1DH
VAT No: 123456789
Total £10.00
`
    const result = resolveMerchant({
      text,
      preferredType: 'receipt',
      userFingerprints: [
        {
          signalType: 'ocr_raw_norm',
          signalValue: 'temporary works consultants',
          canonicalName: 'Creator & Temporary Works Consultants',
        },
      ],
    })

    expect(result.merchantDisplay).toBe('Creator & Temporary Works Consultants')
    expect(result.evidence.some((item) => /OCR name correction/i.test(item))).toBe(true)
  })

  it('applies OCR corrections for bill-to names that score negative', () => {
    const text = `
Invoice
Bill to:
& Temporary Works Consultants
14 High Street
Rotherham
S60 1DH
Bill from:
Someone Else Ltd
VAT No: 123456789
Total £10.00
`
    const result = resolveMerchant({
      text,
      preferredType: 'invoice',
      userFingerprints: [
        {
          signalType: 'ocr_raw_norm',
          signalValue: 'temporary works consultants',
          canonicalName: 'Creator John & Temporary Works Consultants',
        },
      ],
    })

    expect(result.merchantDisplay).toBe('Creator John & Temporary Works Consultants')
    expect(result.evidence.some((item) => /OCR name correction/i.test(item))).toBe(true)
  })

  it('matches OCR corrections when the mangled name is split across lines', () => {
    const text = `
Invoice
Bill to:
& Temporary
Works Consultants
14 High Street
Bill from:
Acme Ltd
VAT No: 123456789
Total £10.00
`
    const result = resolveMerchant({
      text,
      preferredType: 'invoice',
      userFingerprints: [
        {
          signalType: 'ocr_raw_norm',
          signalValue: 'temporary works consultants',
          canonicalName: 'Crater & Temporary Works Consultants',
        },
      ],
    })

    expect(result.merchantDisplay).toBe('Crater & Temporary Works Consultants')
    expect(result.evidence.some((item) => /OCR name correction/i.test(item))).toBe(true)
  })

  it('does not force merchant from customer phone/postcode fingerprints', () => {
    const result = resolveMerchant({
      text: lemonOcr,
      preferredType: 'receipt',
      userFingerprints: [
        {
          signalType: 'phone',
          signalValue: '01143610060',
          canonicalName: 'Creator & Temporary Works Consultants',
        },
        {
          signalType: 'postcode',
          signalValue: 's601dh',
          canonicalName: 'Creator & Temporary Works Consultants',
        },
      ],
    })

    expect(result.merchantDisplay).toBe('Lemon Squeezy')
    expect(result.merchantDisplay).not.toBe('Creator & Temporary Works Consultants')
  })

  it('overrides bill-from with a saved vat fingerprint canonical name', () => {
    const result = resolveMerchant({
      text: lemonOcr,
      preferredType: 'receipt',
      userFingerprints: [
        {
          signalType: 'vat',
          signalValue: '432218330',
          canonicalName: 'My Lemon Tool',
        },
      ],
    })

    expect(result.merchantDisplay).toBe('My Lemon Tool')
    expect(result.evidence.some((item) => /vat fingerprint/i.test(item))).toBe(true)
  })

  it('keeps Ltd/LLC on fingerprint canonical names (no suffix strip)', () => {
    const result = resolveMerchant({
      text: lemonOcr,
      preferredType: 'receipt',
      userFingerprints: [
        {
          signalType: 'vat',
          signalValue: '432218330',
          canonicalName: 'Acme Trading Limited',
        },
      ],
    })

    expect(result.merchantDisplay).toBe('Acme Trading Limited')
    expect(result.merchantRaw).toBe('Acme Trading Limited')
  })
})

describe('matchProcessKindForDocument', () => {
  it('returns remembered process kind from a vat fingerprint', () => {
    expect(
      matchProcessKindForDocument(lemonOcr, [
        {
          signalType: 'vat',
          signalValue: '432218330',
          canonicalName: 'Lemon Squeezy',
          processKind: 'receipt',
        },
      ]),
    ).toBe('receipt')
  })

  it('returns process kind when ocr name is split across lines', () => {
    const text = `
Invoice
Bill to:
& Temporary
Works Consultants
Bill from:
Acme Ltd
VAT No: 123456789
`
    expect(
      matchProcessKindForDocument(text, [
        {
          signalType: 'ocr_raw_norm',
          signalValue: 'temporary works consultants',
          canonicalName: 'Crater & Temporary Works Consultants',
          processKind: 'invoice',
        },
      ]),
    ).toBe('invoice')
  })

  it('returns null when nothing matches', () => {
    expect(
      matchProcessKindForDocument(lemonOcr, [
        {
          signalType: 'vat',
          signalValue: '999999999',
          canonicalName: 'Other',
          processKind: 'cis',
        },
      ]),
    ).toBeNull()
  })
})

describe('matchPrivateUsePercentForDocument', () => {
  it('returns remembered private use percent from a matching fingerprint', () => {
    expect(
      matchPrivateUsePercentForDocument(lemonOcr, [
        {
          signalType: 'vat',
          signalValue: '432218330',
          canonicalName: 'Lemon Squeezy',
          processKind: 'receipt',
          privateUsePercent: 20,
        },
      ]),
    ).toBe(20)
  })

  it('returns null when private use was not selected', () => {
    expect(
      matchPrivateUsePercentForDocument(lemonOcr, [
        {
          signalType: 'vat',
          signalValue: '432218330',
          canonicalName: 'Lemon Squeezy',
          processKind: 'receipt',
          privateUsePercent: null,
        },
      ]),
    ).toBeNull()
  })
})
