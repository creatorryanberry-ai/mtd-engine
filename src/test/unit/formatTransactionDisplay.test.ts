import { describe, expect, it } from 'vitest'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'

import {
  formatTransactionDate,
  getTransactionDisplayLines,
  groupTransactionsByDisplayName,
  sortTransactionsByNewest,
  splitTransactionMerchant,
  toTitleCase,
} from '~/features/mtd/utils/formatTransactionDisplay'

const sampleTransaction = (merchant: string, id: string): MtdTransactionDto => ({
  id,
  merchant,
  category: 'Supplies',
  hmrcCategory: 'uncategorised',
  categorySource: 'uncategorised',
  confidence: 'low',
  needsReview: true,
  categoryType: 'expense',
  date: '2026-06-12',
  dateIso: '2026-06-12',
  amount: -10,
  initials: 'TS',
  color: '#00539F',
  pending: false,
  isManual: false,
})

describe('formatTransactionDisplay', () => {
  it('title-cases merchant names', () => {
    expect(toTitleCase('PARKINS ACCOUNTANT')).toBe('Parkins Accountant')
  })

  it('splits merchant and memo from OFX-style strings', () => {
    expect(splitTransactionMerchant('PAYPAL PAYMENT — 5GL22222W2MSU')).toEqual({
      name: 'PAYPAL PAYMENT',
      memo: '5GL22222W2MSU',
    })
  })

  it('formats dates for display', () => {
    expect(formatTransactionDate('2026-06-26')).toBe('26/06/2026')
  })

  it('builds display lines with category fallback memo', () => {
    expect(
      getTransactionDisplayLines({
        merchant: 'TESCO STORES 6736',
        category: 'Supplies',
        date: '2026-06-12',
      }),
    ).toEqual({
      name: 'Tesco Stores 6736',
      memo: 'Supplies',
      category: null,
      date: '12/06/2026',
    })
  })

  it('shows category separately when already categorised', () => {
    expect(
      getTransactionDisplayLines({
        merchant: 'TESCO STORES 6736',
        category: 'Other business expenses',
        hmrcCategory: 'other_business_expenses',
        date: '2026-06-12',
      }),
    ).toEqual({
      name: 'Tesco Stores 6736',
      memo: null,
      category: 'Other business expenses',
      date: '12/06/2026',
    })
  })

  it('uses displayName when provided', () => {
    expect(
      getTransactionDisplayLines({
        merchant: 'PAYPAL PAYMENT — ABC',
        displayName: 'PayPal',
        category: 'Income',
        date: '2026-06-12',
      }),
    ).toEqual({
      name: 'PayPal',
      memo: 'ABC',
      category: null,
      date: '12/06/2026',
    })
  })

  it('groups transactions by displayName when set', () => {
    const groups = groupTransactionsByDisplayName([
      {
        ...sampleTransaction('PAYPAL PAYMENT — A', '1'),
        displayName: 'PayPal',
      },
      sampleTransaction('TESCO STORES 6736', '2'),
      {
        ...sampleTransaction('PAYPAL PAYMENT — B', '3'),
        displayName: 'PayPal',
      },
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.key).toBe('PayPal')
    expect(groups[0]?.transactions).toHaveLength(2)
  })

  it('groups transactions by display name', () => {
    const groups = groupTransactionsByDisplayName([
      sampleTransaction('PAYPAL PAYMENT — A', '1'),
      sampleTransaction('TESCO STORES 6736', '2'),
      sampleTransaction('PAYPAL PAYMENT — B', '3'),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.transactions).toHaveLength(2)
    expect(groups[0]?.key).toBe('Paypal Payment')
  })

  it('sorts grouped transactions with newest first', () => {
    const groups = groupTransactionsByDisplayName([
      { ...sampleTransaction('PAYPAL PAYMENT — A', '1'), date: '2026-06-01' },
      { ...sampleTransaction('PAYPAL PAYMENT — B', '2'), date: '2026-06-15' },
      { ...sampleTransaction('PAYPAL PAYMENT — C', '3'), date: '2026-06-10' },
    ])

    expect(groups[0]?.transactions.map((transaction) => transaction.id)).toEqual([
      '2',
      '3',
      '1',
    ])
  })

  it('sorts transactions by newest date first', () => {
    const sorted = sortTransactionsByNewest([
      { ...sampleTransaction('A', '1'), date: '2026-06-01' },
      { ...sampleTransaction('B', '2'), date: '2026-06-15' },
      { ...sampleTransaction('C', '3'), date: '2026-06-10' },
    ])

    expect(sorted.map((transaction) => transaction.id)).toEqual(['2', '3', '1'])
  })
})
