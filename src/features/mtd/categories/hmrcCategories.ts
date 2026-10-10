export type HmrcCategoryType = 'income' | 'expense' | 'transfer' | 'personal'

export type HmrcCategory = {
  id: string
  label: string
  type: HmrcCategoryType
  hmrcBox?: number
}

export const HMRC_CATEGORIES: HmrcCategory[] = [
  { id: 'turnover', label: 'Turnover', type: 'income', hmrcBox: 15 },
  {
    id: 'other_business_income',
    label: 'Other business income',
    type: 'income',
    hmrcBox: 16,
  },
  {
    id: 'cost_of_goods',
    label: 'Cost of goods bought for resale',
    type: 'expense',
    hmrcBox: 17,
  },
  {
    id: 'subcontractor_payments',
    label: 'Construction industry subcontractor payments',
    type: 'expense',
    hmrcBox: 18,
  },
  {
    id: 'staff_costs',
    label: 'Wages, salaries and other staff costs',
    type: 'expense',
    hmrcBox: 19,
  },
  {
    id: 'car_van_travel',
    label: 'Car, van and travel expenses',
    type: 'expense',
    hmrcBox: 20,
  },
  {
    id: 'rent_rates_power',
    label: 'Rent, rates, power and insurance costs',
    type: 'expense',
    hmrcBox: 21,
  },
  {
    id: 'repairs_renewals',
    label: 'Repairs and renewals of property and equipment',
    type: 'expense',
    hmrcBox: 22,
  },
  {
    id: 'office_costs',
    label: 'Phone, fax, stationery and other office costs',
    type: 'expense',
    hmrcBox: 23,
  },
  {
    id: 'advertising',
    label: 'Advertising and business entertainment costs',
    type: 'expense',
    hmrcBox: 24,
  },
  {
    id: 'interest',
    label: 'Interest on bank and other loans',
    type: 'expense',
    hmrcBox: 25,
  },
  {
    id: 'mortgage',
    label: 'Mortgage',
    type: 'expense',
    hmrcBox: 25,
  },
  {
    id: 'bank_charges',
    label: 'Bank, credit card and other financial charges',
    type: 'expense',
    hmrcBox: 26,
  },
  {
    id: 'bad_debts',
    label: 'Irrecoverable debts written off',
    type: 'expense',
    hmrcBox: 27,
  },
  {
    id: 'professional_fees',
    label: 'Accountancy, legal and other professional fees',
    type: 'expense',
    hmrcBox: 28,
  },
  {
    id: 'depreciation',
    label: 'Depreciation and loss or profit on sale of assets',
    type: 'expense',
    hmrcBox: 29,
  },
  {
    id: 'other_business_expenses',
    label: 'Other business expenses',
    type: 'expense',
    hmrcBox: 30,
  },
  { id: 'transfer', label: 'Transfer', type: 'transfer' },
  { id: 'personal', label: 'Personal / disallowable', type: 'personal' },
  { id: 'uncategorised', label: 'Uncategorised', type: 'expense' },
]

const categoryById = new Map(HMRC_CATEGORIES.map((category) => [category.id, category]))

export function getHmrcCategory(id: string): HmrcCategory | undefined {
  return categoryById.get(id)
}

export function getHmrcCategoryLabel(id: string) {
  return categoryById.get(id)?.label ?? 'Uncategorised'
}

export function getHmrcCategoryType(id: string): HmrcCategoryType {
  const category = categoryById.get(id)
  if (category) return category.type

  return 'expense'
}

export const HMRC_INCOME_CATEGORIES = HMRC_CATEGORIES.filter((c) => c.type === 'income')
export const HMRC_EXPENSE_CATEGORIES = HMRC_CATEGORIES.filter((c) => c.type === 'expense')
export const HMRC_PICKER_CATEGORIES = HMRC_CATEGORIES.filter(
  (c) => c.id !== 'uncategorised',
)
