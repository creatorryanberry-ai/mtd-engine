import { describe, expect, it } from 'vitest'

import {
  calculateCisVoucherNet,
  CIS_VOUCHER_DESCRIPTION,
  collectCisCustomers,
  formatCisVoucherDetails,
  getCisVoucherDisplayMemo,
  getDefaultCisVoucherDate,
  isCisVoucherDate,
  isCisVoucherMerchant,
  parseCisVoucherAmounts,
  parseCisVoucherTransaction,
  toCisVoucherIsoDate,
} from '~/features/bankAccounts/utils/cisVoucher'

describe('cisVoucher', () => {
  it('builds dates on the 5th only', () => {
    expect(toCisVoucherIsoDate(2026, 7)).toBe('2026-07-05')
    expect(isCisVoucherDate('2026-07-05')).toBe(true)
    expect(isCisVoucherDate('2026-07-06')).toBe(false)
  })

  it('defaults to the latest tax-month end on or before today', () => {
    expect(getDefaultCisVoucherDate(new Date(2026, 6, 10))).toBe('2026-07-05')
    expect(getDefaultCisVoucherDate(new Date(2026, 6, 5))).toBe('2026-07-05')
    expect(getDefaultCisVoucherDate(new Date(2026, 6, 4))).toBe('2026-06-05')
  })

  it('calculates net from gross less tax', () => {
    expect(calculateCisVoucherNet(1000, 200)).toBe(800)
    expect(parseCisVoucherAmounts('1,000.00', '200')).toEqual({
      gross: 1000,
      tax: 200,
      net: 800,
    })
    expect(parseCisVoucherAmounts('100', '0')).toEqual({
      gross: 100,
      tax: 0,
      net: 100,
    })
    expect(parseCisVoucherAmounts('100', '120')).toBeNull()
  })

  it('encodes and parses voucher details for edit', () => {
    expect(formatCisVoucherDetails(1000, 200)).toBe('CIS Voucher | G:1000.00 T:200.00')
    expect(getCisVoucherDisplayMemo('CIS Voucher | G:1000.00 T:200.00')).toBe(
      CIS_VOUCHER_DESCRIPTION,
    )
    expect(isCisVoucherMerchant('Acme Builders — CIS Voucher | G:1000.00 T:200.00')).toBe(
      true,
    )
    expect(
      parseCisVoucherTransaction({
        merchant: 'Acme Builders — CIS Voucher | G:1000.00 T:200.00',
        amount: 1000,
      }),
    ).toEqual({
      customer: 'Acme Builders',
      gross: 1000,
      tax: 200,
      net: 800,
    })
  })

  it('collects unique customers from previous vouchers', () => {
    expect(
      collectCisCustomers([
        { merchant: 'Acme Builders — CIS Voucher | G:1000.00 T:200.00' },
        { merchant: 'acme builders — CIS Voucher | G:500.00 T:100.00' },
        { merchant: 'Site Co — CIS Voucher | G:300.00 T:60.00' },
        { merchant: 'Foxtons — Landlord Statement | G:2000.00 E:150.00 V:30.00' },
      ]),
    ).toEqual(['Acme Builders', 'Site Co'])
  })
})
