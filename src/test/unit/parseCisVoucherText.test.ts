import { describe, expect, it } from 'vitest'

import { parseCisVoucherText } from '~/features/mtd/receipt/parseCisVoucherText'

const SAMPLE_STATEMENT = `
SubContractor Monthly Statement
Habbin Homes Ltd
6 Moatlands
Wickersley
Rotherham
S66 1DQ
Contractor's Employer Reference Number: 120/TB12670
Construction Industry Scheme
Statement of payment and deduction for month ending: 05/07/2026
Subcontractor
Name: JOSEPH BOSTON
Unique Taxpayer Reference: 2102934118
NINO: JS754045B
CRN:
Higher Rate Verification Number:
Gross Amount Paid (Excl VAT and CITB levy) (A): 1,190.00
Less cost of materials: 0.00
Amount liable to deduction: 1,190.00
CIS Tax Deducted (B): 238.00
Amount Payable (A-B): 952.00
`

describe('parseCisVoucherText', () => {
  it('extracts customer, date, gross, tax, and net from a monthly statement', () => {
    expect(parseCisVoucherText(SAMPLE_STATEMENT)).toEqual({
      customer: 'Habbin Homes Ltd',
      date: '2026-07-05',
      gross: '1190.00',
      tax: '238.00',
      net: '952.00',
    })
  })

  it('reads amounts when ocr places values on the next line', () => {
    const text = `
SubContractor Monthly Statement
Acme Builders Ltd
14 Site Road
London
E1 1AA
month ending
05/06/2026
Gross Amount Paid (Excl VAT and CITB levy) (A)
2,500.00
CIS Tax Deducted (B)
500.00
Amount Payable (A-B)
2,000.00
`

    expect(parseCisVoucherText(text)).toEqual({
      customer: 'Acme Builders Ltd',
      date: '2026-06-05',
      gross: '2500.00',
      tax: '500.00',
      net: '2000.00',
    })
  })

  it('snaps month-ending dates to the cis voucher day', () => {
    const text = `
SubContractor Monthly Statement
Riverside Homes Ltd
1 High Street
Leeds
LS1 1AA
Statement of payment and deduction for month ending: 30/04/2026
Gross Amount Paid 800.00
CIS Tax Deducted 160.00
Amount Payable 640.00
`

    expect(parseCisVoucherText(text)).toMatchObject({
      customer: 'Riverside Homes Ltd',
      date: '2026-04-05',
      gross: '800.00',
      tax: '160.00',
      net: '640.00',
    })
  })

  it('returns nulls for empty text', () => {
    expect(parseCisVoucherText('')).toEqual({
      customer: null,
      date: null,
      gross: null,
      tax: null,
      net: null,
    })
  })
})
