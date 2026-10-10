export type TransactionEditCategoryId =
  | 'business_expense'
  | 'income'
  | 'mortgage'
  | 'personal'

export type TransactionEditCategory = {
  id: TransactionEditCategoryId
  label: string
  hmrcCategory: string
}

/** hmrc categories that can carry a private-use percentage */
export const PRIVATE_USE_HMRC_CATEGORIES = new Set([
  'other_business_expenses',
  'office_costs',
  'car_van_travel',
  'rent_rates_power',
])

export function supportsPrivateUse(hmrcCategory: string) {
  return PRIVATE_USE_HMRC_CATEGORIES.has(hmrcCategory)
}

export const TRANSACTION_EDIT_CATEGORIES: TransactionEditCategory[] = [
  {
    id: 'business_expense',
    label: 'Business Expense',
    hmrcCategory: 'other_business_expenses',
  },
  {
    id: 'income',
    label: 'Income',
    hmrcCategory: 'turnover',
  },
  {
    id: 'mortgage',
    label: 'Mortgage',
    hmrcCategory: 'mortgage',
  },
  {
    id: 'personal',
    label: 'Personal',
    hmrcCategory: 'personal',
  },
]

export function getHmrcCategoryForEditCategory(id: TransactionEditCategoryId) {
  return (
    TRANSACTION_EDIT_CATEGORIES.find((category) => category.id === id)?.hmrcCategory ??
    'uncategorised'
  )
}

export function getEditCategoryIdForHmrc(
  hmrcCategory: string,
): TransactionEditCategoryId | null {
  const exact = TRANSACTION_EDIT_CATEGORIES.find(
    (category) => category.hmrcCategory === hmrcCategory,
  )?.id
  if (exact) return exact

  // shared-cost hmrc boxes open as business expense in the simplified edit ui
  if (supportsPrivateUse(hmrcCategory)) return 'business_expense'

  return null
}

export function resolveBusinessExpenseHmrcCategory(options: {
  selectedCategory: TransactionEditCategoryId
  existingHmrcCategory?: string | null
  preferredHmrcCategory?: string | null
}) {
  if (options.selectedCategory !== 'business_expense') {
    return getHmrcCategoryForEditCategory(options.selectedCategory)
  }

  if (
    options.preferredHmrcCategory &&
    supportsPrivateUse(options.preferredHmrcCategory)
  ) {
    return options.preferredHmrcCategory
  }

  if (options.existingHmrcCategory && supportsPrivateUse(options.existingHmrcCategory)) {
    return options.existingHmrcCategory
  }

  return getHmrcCategoryForEditCategory('business_expense')
}

export function sanitizePrivateUsePercent(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''

  const parsed = Number.parseInt(digits, 10)
  if (parsed < 1) return ''
  if (parsed > 99) return '99'
  return String(parsed)
}

export function getBusinessExpenseAmount(amount: number, privateUsePercent: number) {
  const businessFraction = 1 - privateUsePercent / 100
  return amount * businessFraction
}

export function normalizeRulePrivateUsePercent(
  hmrcCategory: string,
  privateUsePercent: number | null | undefined,
) {
  if (!supportsPrivateUse(hmrcCategory)) return null
  if (privateUsePercent == null || privateUsePercent < 1 || privateUsePercent > 99) {
    return null
  }
  return privateUsePercent
}

export function getPrivateUseStateFromRulePercent(
  privateUsePercent: number | null | undefined,
) {
  if (privateUsePercent == null || privateUsePercent < 1 || privateUsePercent > 99) {
    return { hasPrivateUse: false, privateUsePercent: '' }
  }

  return { hasPrivateUse: true, privateUsePercent: String(privateUsePercent) }
}

export function getEffectivePrivateUsePercent(
  transaction: { hmrcCategory: string; privateUsePercent?: number | null },
  privateUsePercent?: number | null,
) {
  const effective = privateUsePercent ?? transaction.privateUsePercent
  if (
    effective != null &&
    effective >= 1 &&
    effective <= 99 &&
    supportsPrivateUse(transaction.hmrcCategory)
  ) {
    return effective
  }

  return null
}

export function formatPrivateUseLabel(privateUsePercent: number) {
  return `Private use: ${privateUsePercent}%`
}
