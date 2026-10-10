import { describe, expect, it } from 'vitest'

import { parseLandlordStatementText } from '~/features/mtd/receipt/parseLandlordStatementText'

const FLEX_RESIDENTIAL_STATEMENT = `
FlexResidential
01709 762555
lettings@flexresidential.co.uk
flexresidential.co.uk
RDP of Rotherham Ltd
5 Beech Avenue
Rotherham
South Yorkshire
S65 3HN
Our Ref: LS4650
STATEMENT: 26 May 2026
Description   Income   Deductions ex. VAT   VAT   Total
9a Elder Drive - Miss Shannon Flannery
Rent 23/05/2026 - 22/06/2026   £800.00
Management Fee (9%) 23/05/2026 - 22/06/2026   £72.00   £0.00
Mis-calculation with regards to recent work. Error with invoice and not including the VAT   £22.00   £0.00
£800.00   £94.00   £0.00   £706.00
Opening Balance   £0.00
BALANCE   £706.00
Paid on 26/05/2026   £706.00
Closing Balance   £0.00
If there is a negative balance, please pay this to the following bank account
FLEX RESIDENTIAL LTD CLIENT ACCOUNT
Client Premium Deposit Account
A/N 42075736
S/C 23-05-80
REF - 9a Elder Drive
`

const HARRIS_SHIELDS_STATEMENT = `
Harris Shields Collection
Opening doors for over 60 years
64 Flamborough Road
Bridlington
Mr John G Clifford
11 Hoober View
Upper Haugh
Rotherham
South Yorkshire
S62 7LN
VAT No: 843072148
Date: 04/08/2026
Reference: BRL210005
Statement Number: 47
Landlord Statement to 04/08/2026
Date   Description   Payments   Receipts
Opening Balance   £0.00
Flat 1 2 Lansdowne Crescent
Income
04/08/2026 Rent from 01/08/2026 to 31/08/2026   £560.00
Expenditure
04/08/2026 Invoice from AJM: Weekly Fire Alarm Checks - July 2026   £50.00
04/08/2026 Management fees at 11% for 01/08/2026 to 31/08/2026   £73.92
Flat 2 2 Lansdowne Crescent
Income
04/08/2026 Rent from 04/08/2026 to 10/08/2026   £120.00
Expenditure
04/08/2026 Management fees at 11%   £63.36
Flat 3 2 Lansdowne Crescent
Income
03/08/2026 Rent from 16/07/2026 to 15/08/2026   £370.00
Expenditure
04/08/2026 Invoice from D Robinson: complete gas check - urgent   £90.00
04/08/2026 Management fees at 10% for 16/07/2026 to 15/08/2026   £56.40
General Landlord Payments
04/08/2026 Payment to Landlord   £1,176.32
Subtotal   £1,510.00   £1,510.00
Closing Balance   £0.00
Float Held   £0.00
`

describe('parseLandlordStatementText', () => {
  it('parses flexresidential income / deductions / vat statements', () => {
    expect(parseLandlordStatementText(FLEX_RESIDENTIAL_STATEMENT)).toEqual({
      lettingAgent: 'Flex Residential Ltd',
      date: '2026-05-26',
      grossRents: '800.00',
      expenses: '94.00',
      vatOnExpenses: '0.00',
      netReceived: '706.00',
    })
  })

  it('parses harris shields payments / receipts statements', () => {
    expect(parseLandlordStatementText(HARRIS_SHIELDS_STATEMENT)).toEqual({
      lettingAgent: 'Harris Shields Collection',
      date: '2026-08-04',
      grossRents: '1510.00',
      expenses: '333.68',
      vatOnExpenses: '0.00',
      netReceived: '1176.32',
    })
  })

  it('joins logo brand when ocr splits harris shields and collection', () => {
    const text = HARRIS_SHIELDS_STATEMENT.replace(
      'Harris Shields Collection\n',
      'Harris Shields\nCollection\n',
    )

    expect(parseLandlordStatementText(text).lettingAgent).toBe(
      'Harris Shields Collection',
    )
  })

  it('does not treat bare Collection as the letting agent', () => {
    const text = `
Collection
Mr John G Clifford
11 Hoober View
Upper Haugh
Rotherham
S62 7LN
Date: 04/08/2026
Payment to Landlord £1,176.32
Subtotal £1,510.00 £1,510.00
`

    expect(parseLandlordStatementText(text).lettingAgent).not.toBe('Collection')
  })

  it('does not use the contact email as the letting agent name', () => {
    const text = `
Opening doors for over 60 years
64 Flamborough Road
Bridlington
East Yorkshire
YO15 2JN
01262 401011
rentals@harris-shieldscollection.uk
www.harris-shieldscollection.uk
Mr John G Clifford
11 Hoober View
Upper Haugh
Rotherham
S62 7LN
Date: 04/08/2026
Payment to Landlord £1,176.32
Subtotal £1,510.00 £1,510.00
`

    expect(parseLandlordStatementText(text).lettingAgent).toBe(
      'Harris Shields Collection',
    )
  })

  it('uses client account name when logo text is missing', () => {
    const text = `
RDP of Rotherham Ltd
5 Beech Avenue
Rotherham
S65 3HN
STATEMENT: 26 May 2026
Description Income Deductions ex. VAT VAT Total
£800.00 £94.00 £0.00 £706.00
Opening Balance £0.00
FLEX RESIDENTIAL LTD CLIENT ACCOUNT
`

    expect(parseLandlordStatementText(text)).toMatchObject({
      lettingAgent: 'Flex Residential Ltd',
      grossRents: '800.00',
      expenses: '94.00',
      vatOnExpenses: '0.00',
      netReceived: '706.00',
    })
  })

  it('finds totals when ocr splits the four amounts onto separate lines', () => {
    const text = `
FlexResidential
STATEMENT: 26 May 2026
Description Income Deductions ex. VAT VAT Total
Rent £800.00
Management Fee £72.00 £0.00
£800.00
£94.00
£0.00
£706.00
Opening Balance £0.00
FLEX RESIDENTIAL LTD CLIENT ACCOUNT
`

    expect(parseLandlordStatementText(text)).toMatchObject({
      lettingAgent: 'Flex Residential Ltd',
      grossRents: '800.00',
      expenses: '94.00',
      vatOnExpenses: '0.00',
      netReceived: '706.00',
    })
  })

  it('parses real-device ocr where totals are shuffled above opening balance', () => {
    const text = `
01709 762555
lettings@flexresidential.co.uk
FlexResidential
Our Ref: LS4650
RDP of Rotherham Ltd
5 Beech Avenue
Rotherham
S65 3HN
STATEMENT: 26 May 2026
Deductions
Total
VAT
Income
Description
ex. VAT
9a Elder Drive - Miss Shannon Flannery
Rent 23/05/2026 - 22/06/2026
£800.00
Management Fee (9%) 23/05/2026 - 22/06/2026
€0.00
£72.00
Mis-calculation with regards to recent work. Error with
£22.00
E0.00
invoice and not including the VAT
£706.00
£800.00
£94.00
E0.00
Opening Balance
£0.00
BALANCE
£706.00
Paid on 26/05/2026
£706.00
Closing Balance
£0.00
FLEX RESIDENTIAL LTD CLIENT ACCOUNT
`

    expect(parseLandlordStatementText(text)).toEqual({
      lettingAgent: 'Flex Residential Ltd',
      date: '2026-05-26',
      grossRents: '800.00',
      expenses: '94.00',
      vatOnExpenses: '0.00',
      netReceived: '706.00',
    })
  })

  it('parses payment-to-landlord statements without a shared header line', () => {
    const text = `
Harris Shields Collection
Date: 04/08/2026
Payment to Landlord
£1,176.32
Subtotal
£1,510.00
£1,510.00
`

    expect(parseLandlordStatementText(text)).toMatchObject({
      lettingAgent: 'Harris Shields Collection',
      date: '2026-08-04',
      grossRents: '1510.00',
      expenses: '333.68',
      vatOnExpenses: '0.00',
      netReceived: '1176.32',
    })
  })
})
