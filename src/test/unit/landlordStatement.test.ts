import { describe, expect, it } from 'vitest'

import {
  calculateLandlordStatementNet,
  collectLettingAgents,
  formatLandlordStatementDetails,
  getDefaultMonthEndDate,
  getLandlordStatementDisplayMemo,
  isLandlordStatementMerchant,
  LANDLORD_STATEMENT_DESCRIPTION,
  parseLandlordStatementAmounts,
  parseLandlordStatementTransaction,
} from '~/features/bankAccounts/utils/landlordStatement'

describe('landlordStatement', () => {
  it('defaults month end to the last day of the previous month', () => {
    expect(getDefaultMonthEndDate(new Date(2026, 6, 10))).toBe('2026-06-30')
    expect(getDefaultMonthEndDate(new Date(2026, 0, 15))).toBe('2025-12-31')
  })

  it('calculates net received from gross less expenses and vat', () => {
    expect(calculateLandlordStatementNet(2000, 150, 30)).toBe(1820)
    expect(parseLandlordStatementAmounts('2,000.00', '150', '30')).toEqual({
      grossRents: 2000,
      expenses: 150,
      vatOnExpenses: 30,
      netReceived: 1820,
    })
    expect(parseLandlordStatementAmounts('100', '', '')).toEqual({
      grossRents: 100,
      expenses: 0,
      vatOnExpenses: 0,
      netReceived: 100,
    })
    expect(parseLandlordStatementAmounts('100', '0', '0')).toEqual({
      grossRents: 100,
      expenses: 0,
      vatOnExpenses: 0,
      netReceived: 100,
    })
    expect(parseLandlordStatementAmounts('100', '80', '30')).toBeNull()
  })

  it('encodes and parses statement details for edit', () => {
    expect(formatLandlordStatementDetails(2000, 150, 30)).toBe(
      'Landlord Statement | G:2000.00 E:150.00 V:30.00',
    )
    expect(
      getLandlordStatementDisplayMemo('Landlord Statement | G:2000.00 E:150.00 V:30.00'),
    ).toBe(LANDLORD_STATEMENT_DESCRIPTION)
    expect(
      isLandlordStatementMerchant(
        'Foxtons — Landlord Statement | G:2000.00 E:150.00 V:30.00',
      ),
    ).toBe(true)
    expect(
      parseLandlordStatementTransaction({
        merchant: 'Foxtons — Landlord Statement | G:2000.00 E:150.00 V:30.00',
        amount: 2000,
      }),
    ).toEqual({
      lettingAgent: 'Foxtons',
      grossRents: 2000,
      expenses: 150,
      vatOnExpenses: 30,
      netReceived: 1820,
    })
  })

  it('collects unique letting agents from previous statements', () => {
    expect(
      collectLettingAgents([
        {
          merchant: 'Foxtons — Landlord Statement | G:2000.00 E:150.00 V:30.00',
        },
        {
          merchant: 'foxtons — Landlord Statement | G:1800.00 E:100.00 V:20.00',
        },
        {
          merchant: 'Savills — Landlord Statement | G:900.00 E:50.00 V:10.00',
        },
        { merchant: 'Tesco — CIS Voucher | G:100.00 T:20.00' },
      ]),
    ).toEqual(['Foxtons', 'Savills'])
  })
})
