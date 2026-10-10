import { describe, expect, it } from 'vitest'

import { parseReceiptText } from '~/features/mtd/receipt/parseReceiptText'

describe('parseReceiptText', () => {
  it('extracts supplier, uk date, and total from a typical receipt', () => {
    const text = `
TESCO STORES
123 High Street
London
Date: 14/03/2026
Milk 1.20
Bread 0.95
VAT 0.36
TOTAL £12.50
Thank you
`

    expect(parseReceiptText(text)).toEqual({
      supplier: 'Tesco',
      date: '2026-03-14',
      amount: '12.50',
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    })
  })

  it('parses day month year dates and prefers labeled totals', () => {
    const text = `
Screwfix Direct
Sale Date 9 Jul 2026
Subtotal 40.00
VAT 8.00
Amount Due 48.00
`

    expect(parseReceiptText(text)).toEqual({
      supplier: 'Screwfix',
      date: '2026-07-09',
      amount: '48.00',
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    })
  })

  it('falls back to the largest money amount when no total label exists', () => {
    const text = `
Corner Shop
01/02/26
Item A 3.00
Item B 7.25
`

    expect(parseReceiptText(text)).toEqual({
      supplier: 'Corner Shop',
      date: '2026-02-01',
      amount: '7.25',
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    })
  })

  it('returns nulls for empty text', () => {
    expect(parseReceiptText('')).toEqual({
      supplier: null,
      date: null,
      amount: null,
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    })
  })

  it('leaves merchant blank when only line items exist (no confident merchant)', () => {
    const text = `
Ticket: 22
Receipt: H5tn
Authorization: AV5IKK
VAT # 307584200
DEBIT MASTERCARD
AID A0 00 00 00 04 10 10
Cappuccino £4.00 A
Decaf £3.50 A
`

    expect(parseReceiptText(text)).toEqual({
      supplier: null,
      date: null,
      amount: '4.00',
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    })
  })

  it('parses kitchen receipts with euro totals and month-first dates', () => {
    const text = `
South Street Kitchen
July 15, 2026
19-20 South Street
Sheffield
EAT IN
Cappuccino
£4.00 A
Flat White
£3.80 A
Total
€7.80
`

    expect(parseReceiptText(text)).toEqual({
      supplier: 'South Street Kitchen',
      date: '2026-07-15',
      amount: '7.80',
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    })
  })

  it('uses the supplier header for a supplier invoice treated as a receipt', () => {
    const text = `
Invoice
Invoice number 86350697-0027
Date of issue 10 August 2026
Driversnote ApS
Skelbækgade 4 3th
1717 Copenhagen V
Denmark
Bill to
Tim Neale ltd
3 hartshaw, 35 Moorgate road
Rotherham
£10.80 due
`

    expect(parseReceiptText(text, 'receipt')).toMatchObject({
      supplier: 'Driversnote',
      date: '2026-08-10',
      amount: '10.80',
    })
  })

  it('strips leading bullet markers from supplier names', () => {
    const text = `
• driversnote
Date 10/08/2026
Total £10.80
`

    expect(parseReceiptText(text, 'receipt')).toMatchObject({
      supplier: 'Driversnote',
      amount: '10.80',
    })
  })

  it('normalises known merchant display names', () => {
    expect(
      parseReceiptText(
        `
driversnote aps
Date 10/08/2026
Total £10.80
`,
        'receipt',
      ).supplier,
    ).toBe('Driversnote')
  })

  it('prefers the company name above the address over a logo word', () => {
    const text = `
• driversnote
Invoice
Invoice number 86350697-0027
Date of issue 10 August 2026
Driversnote ApS
Skelbækgade 4 3th
1717 Copenhagen V
Denmark
Bill to
Tim Neale ltd
£10.80 due
`

    expect(parseReceiptText(text, 'receipt')).toMatchObject({
      supplier: 'Driversnote',
      date: '2026-08-10',
      amount: '10.80',
    })
  })

  it('uses Bill from for the supplier name when present', () => {
    const text = `
Invoice
Bill from
Driversnote ApS
Skelbækgade 4 3th
Bill to
Tim Neale ltd
Date 10/08/2026
Total £10.80
`

    expect(parseReceiptText(text, 'receipt')).toMatchObject({
      supplier: 'Driversnote',
      amount: '10.80',
    })
  })

  it('uses inline Bill from for the supplier name', () => {
    const text = `
Bill from: Acme Supplies Ltd
Bill to: Tim Neale Ltd
Date 01/07/2026
Total 45.00
`

    expect(parseReceiptText(text, 'receipt').supplier).toBe('Acme Supplies')
  })

  it('uses Bill from on a Lemon Squeezy invoice instead of Need help', () => {
    const text = `
Need help?
Invoice number: 5724131
Date of issue: 13 June 2025
Bill to: Creator Scaffold Design
Fullerton House, Fullerton Road
Rotherham
S60 1DH
United Kingdom
Bill from: Lemon Squeezy LLC
354 Oyster Point Blvd.
South San Francisco
CA, 94080
United States
Invoice Total
$108.00
`

    expect(parseReceiptText(text, 'receipt')).toMatchObject({
      supplier: 'Lemon Squeezy',
      date: '2025-06-13',
      amount: '108.00',
    })
  })
})

describe('parseReceiptText invoice', () => {
  it('uses Bill To customer instead of the header business name', () => {
    const text = `
My Building Co Ltd
Invoice
Invoice Date 12/06/2026
Bill To
Acme Developments Ltd
14 Builder Street
London
Labour 1000.00
VAT 200.00
Total £1200.00
`

    expect(parseReceiptText(text, 'invoice')).toEqual({
      supplier: 'Acme Developments Ltd',
      date: '2026-06-12',
      amount: '1200.00',
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    })
  })

  it('reads invoice number into its own field', () => {
    const text = `
TIM NEALE
Invoice Number:
1478
Invoice Date:
23 May 2026
BILL TO
Creator Scaffold Designs Ltd
TOTAL
£3,000.00
`

    expect(parseReceiptText(text, 'invoice')).toMatchObject({
      supplier: 'Creator Scaffold Designs Ltd',
      date: '2026-05-23',
      amount: '3000.00',
      invoiceNumber: '1478',
    })
  })

  it('reads invoice number when ocr places it above the label', () => {
    const text = `
INVOICE
TIM NEALE
1479
Invoice Number:
SOFTWARE ENGINEERING —
Invoice Date:
23 August 2026
BILL TO
Creator Scaffold Designs Ltd
TOTAL
£3,000.00
`

    expect(parseReceiptText(text, 'invoice')).toMatchObject({
      supplier: 'Creator Scaffold Designs Ltd',
      date: '2026-08-23',
      amount: '3000.00',
      invoiceNumber: '1479',
    })
  })

  it('reads inline Bill To customer', () => {
    const text = `
Curator Construction
Bill To: Riverside Homes Ltd
Date: 01/07/2026
Amount Due 450.00
`

    expect(parseReceiptText(text, 'invoice')).toEqual({
      supplier: 'Riverside Homes Ltd',
      date: '2026-07-01',
      amount: '450.00',
      invoiceNumber: null,
      nameCandidates: [],
      nameNeedsConfirm: false,
    })
  })

  it('asks when multiple bill-to names are plausible', () => {
    const text = `
My Company Ltd
Invoice To
Acme Developments Ltd
Site Contact Bob Smith
Date 03/05/2026
Total 900.00
`

    expect(parseReceiptText(text, 'invoice')).toEqual({
      supplier: null,
      date: '2026-05-03',
      amount: '900.00',
      invoiceNumber: null,
      nameCandidates: ['Acme Developments Ltd', 'Site Contact Bob Smith'],
      nameNeedsConfirm: true,
    })
  })

  it('asks when bill to is missing rather than using the header', () => {
    const text = `
My Building Co Ltd
Invoice Date 12/06/2026
Labour 1000.00
Total £1200.00
`

    expect(parseReceiptText(text, 'invoice')).toEqual({
      supplier: null,
      date: '2026-06-12',
      amount: '1200.00',
      invoiceNumber: null,
      nameCandidates: ['My Building Co Ltd'],
      nameNeedsConfirm: true,
    })
  })
})
