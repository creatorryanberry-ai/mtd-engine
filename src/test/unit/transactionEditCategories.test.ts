import { describe, expect, test } from 'vitest'

import {
  TRANSACTION_EDIT_CATEGORIES,
  getEditCategoryIdForHmrc,
  getHmrcCategoryForEditCategory,
  getBusinessExpenseAmount,
  getEffectivePrivateUsePercent,
  getPrivateUseStateFromRulePercent,
  formatPrivateUseLabel,
  normalizeRulePrivateUsePercent,
  resolveBusinessExpenseHmrcCategory,
  sanitizePrivateUsePercent,
  supportsPrivateUse,
} from '~/features/mtd/categories/transactionEditCategories'

describe('transactionEditCategories', () => {
  test('maps simplified categories to hmrc ids', () => {
    expect(getHmrcCategoryForEditCategory('business_expense')).toBe(
      'other_business_expenses',
    )
    expect(getHmrcCategoryForEditCategory('income')).toBe('turnover')
    expect(getHmrcCategoryForEditCategory('mortgage')).toBe('mortgage')
    expect(getHmrcCategoryForEditCategory('personal')).toBe('personal')
  })

  test('exposes four edit options', () => {
    expect(TRANSACTION_EDIT_CATEGORIES.map((category) => category.label)).toEqual([
      'Business Expense',
      'Income',
      'Mortgage',
      'Personal',
    ])
  })

  test('maps shared-cost hmrc categories to business expense edit ui', () => {
    expect(getEditCategoryIdForHmrc('office_costs')).toBe('business_expense')
    expect(getEditCategoryIdForHmrc('car_van_travel')).toBe('business_expense')
    expect(getEditCategoryIdForHmrc('rent_rates_power')).toBe('business_expense')
    expect(getEditCategoryIdForHmrc('other_business_expenses')).toBe('business_expense')
    expect(getEditCategoryIdForHmrc('turnover')).toBe('income')
    expect(getEditCategoryIdForHmrc('advertising')).toBeNull()
  })

  test('resolves preferred or existing shared-cost hmrc category on save', () => {
    expect(
      resolveBusinessExpenseHmrcCategory({
        selectedCategory: 'business_expense',
        preferredHmrcCategory: 'office_costs',
      }),
    ).toBe('office_costs')
    expect(
      resolveBusinessExpenseHmrcCategory({
        selectedCategory: 'business_expense',
        existingHmrcCategory: 'car_van_travel',
      }),
    ).toBe('car_van_travel')
    expect(
      resolveBusinessExpenseHmrcCategory({
        selectedCategory: 'business_expense',
      }),
    ).toBe('other_business_expenses')
    expect(
      resolveBusinessExpenseHmrcCategory({
        selectedCategory: 'income',
        preferredHmrcCategory: 'office_costs',
      }),
    ).toBe('turnover')
  })

  test('sanitizes private use percent to 1-99', () => {
    expect(sanitizePrivateUsePercent('')).toBe('')
    expect(sanitizePrivateUsePercent('0')).toBe('')
    expect(sanitizePrivateUsePercent('1')).toBe('1')
    expect(sanitizePrivateUsePercent('50')).toBe('50')
    expect(sanitizePrivateUsePercent('99')).toBe('99')
    expect(sanitizePrivateUsePercent('100')).toBe('99')
    expect(sanitizePrivateUsePercent('12a3')).toBe('99')
    expect(sanitizePrivateUsePercent('4a5')).toBe('45')
  })

  test('calculates business expense amount after private use', () => {
    expect(getBusinessExpenseAmount(-100, 50)).toBe(-50)
    expect(getBusinessExpenseAmount(200, 25)).toBe(150)
    expect(getBusinessExpenseAmount(99.99, 10)).toBeCloseTo(89.991)
  })

  test('normalizes private use for shared-cost expense categories', () => {
    expect(supportsPrivateUse('other_business_expenses')).toBe(true)
    expect(supportsPrivateUse('office_costs')).toBe(true)
    expect(supportsPrivateUse('car_van_travel')).toBe(true)
    expect(supportsPrivateUse('rent_rates_power')).toBe(true)
    expect(supportsPrivateUse('turnover')).toBe(false)
    expect(normalizeRulePrivateUsePercent('other_business_expenses', 50)).toBe(50)
    expect(normalizeRulePrivateUsePercent('office_costs', 40)).toBe(40)
    expect(normalizeRulePrivateUsePercent('car_van_travel', 25)).toBe(25)
    expect(normalizeRulePrivateUsePercent('rent_rates_power', 30)).toBe(30)
    expect(normalizeRulePrivateUsePercent('turnover', 50)).toBeNull()
    expect(normalizeRulePrivateUsePercent('other_business_expenses', 0)).toBeNull()
  })

  test('maps stored private use to edit state', () => {
    expect(getPrivateUseStateFromRulePercent(50)).toEqual({
      hasPrivateUse: true,
      privateUsePercent: '50',
    })
    expect(getPrivateUseStateFromRulePercent(null)).toEqual({
      hasPrivateUse: false,
      privateUsePercent: '',
    })
  })

  test('formats private use label for transaction lists', () => {
    expect(formatPrivateUseLabel(50)).toBe('Private use: 50%')
    expect(
      getEffectivePrivateUsePercent({
        hmrcCategory: 'other_business_expenses',
        privateUsePercent: 50,
      }),
    ).toBe(50)
    expect(
      getEffectivePrivateUsePercent({
        hmrcCategory: 'office_costs',
        privateUsePercent: 40,
      }),
    ).toBe(40)
    expect(
      getEffectivePrivateUsePercent({
        hmrcCategory: 'turnover',
        privateUsePercent: 50,
      }),
    ).toBeNull()
  })
})
