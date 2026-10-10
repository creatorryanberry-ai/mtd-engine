import { describe, expect, it } from 'vitest'

import {
  formatAmountInputValue,
  getSignedAmountForCategory,
  isManualTransaction,
  isValidIsoDate,
  joinMerchantName,
  parseAmountInput,
  parseManualTransactionFields,
} from '~/features/bankAccounts/utils/manualTransaction'

describe('manualTransaction', () => {
  it('identifies manual transactions by the manual id prefix', () => {
    expect(isManualTransaction('manual:abc-123')).toBe(true)
    expect(isManualTransaction('ext:account:fitid')).toBe(false)
  })

  it('joins and parses merchant name with details', () => {
    expect(joinMerchantName('Rent', 'Flat 2')).toBe('Rent — Flat 2')
    expect(parseManualTransactionFields('Rent — Flat 2')).toEqual({
      name: 'Rent',
      memo: 'Flat 2',
    })
  })

  it('validates iso dates', () => {
    expect(isValidIsoDate('2026-07-09')).toBe(true)
    expect(isValidIsoDate('09/07/2026')).toBe(false)
  })

  it('parses amount input', () => {
    expect(parseAmountInput('12.50')).toBe(12.5)
    expect(parseAmountInput('£1,234.00')).toBe(1234)
    expect(parseAmountInput('')).toBeNull()
  })

  it('derives signed amounts from category', () => {
    expect(getSignedAmountForCategory(25, 'income')).toBe(25)
    expect(getSignedAmountForCategory(25, 'business_expense')).toBe(-25)
    expect(formatAmountInputValue(-42.5)).toBe('42.50')
  })
})
