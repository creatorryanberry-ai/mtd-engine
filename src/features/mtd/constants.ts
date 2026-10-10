import { MTD_TOKENS } from './mtdTokens'

/** @deprecated Use MTD_TOKENS — kept temporarily for any external references */
export const MTD_COLORS = MTD_TOKENS

export const MTD_ROUTES = {
  overview: '/home/feed',
  records: '/home/records',
  bankAccounts: '/home/bank-accounts',
  downloadTransactions: '/home/bank-accounts',
  categoriseTransactions: '/home/categorise-transactions',
  categorisationRules: '/home/categorisation-rules',
  submissions: '/home/submissions',
  yearEnd: '/home/submissions/year-end',
  submitToHmrc: '/home/submit-to-hmrc',
  mileage: '/home/mileage',
  inbox: '/home/inbox',
  notifications: '/home/notification',
  settings: '/home/settings',
  settingsBankAccounts: '/home/settings/bank-accounts',
  settingsBusinessSetup: '/home/settings/business-setup',
  settingsMtdEmail: '/home/settings/mtd-email',
  businessSetup: '/home/business-setup',
  estimatedTax: '/home/estimated-tax',
  estimatedTaxSummary: '/home/estimated-tax/summary',
  estimatedTaxBreakdown: '/home/estimated-tax/breakdown',
} as const

export const MTD_STEPS = [
  {
    step: 1,
    title: 'Record',
    description: 'Keep your money up to date',
    actionLabel: 'Open',
  },
  {
    step: 2,
    title: 'Review',
    description: "Make sure nothing's been missed",
    actionLabel: 'Review',
  },
  {
    step: 3,
    title: 'Submit',
    description: 'Quarterly submission',
    actionLabel: 'Continue',
  },
] as const

export const MTD_SUMMARY = [
  {
    label: 'Next submission due',
    value: '5 Jul 2024',
    sub: 'Q1 2024/25',
    icon: 'calendar' as const,
  },
  {
    label: 'Estimated tax',
    value: '£2,840',
    sub: 'For this quarter',
    icon: 'calculator' as const,
  },
  {
    label: 'MTD status',
    value: 'Compliant',
    sub: "You're all set",
    icon: 'check' as const,
  },
  {
    label: 'HMRC connection',
    value: 'Connected',
    sub: 'Last checked today',
    icon: 'document' as const,
  },
] as const

export const MTD_TAB_BAR_HEIGHT = 72

export type MtdTabIcon = 'home' | 'records' | 'submissions' | 'more'

export type MtdTab = {
  id: string
  label: string
  icon: MtdTabIcon
}

export const MTD_TAB_CONFIG = {
  home: { id: 'home', label: 'Home', icon: 'home' as const },
  records: { id: 'records', label: 'Records', icon: 'records' as const },
  submissions: { id: 'submissions', label: 'Submissions', icon: 'submissions' as const },
  more: { id: 'more', label: 'Settings', icon: 'more' as const },
} satisfies Record<string, MtdTab>

export function getMtdTabs(_options?: { showMileage?: boolean }): MtdTab[] {
  return [
    MTD_TAB_CONFIG.home,
    MTD_TAB_CONFIG.records,
    MTD_TAB_CONFIG.submissions,
    MTD_TAB_CONFIG.more,
  ]
}

/** @deprecated use getMtdTabs() */
export const MTD_TABS = getMtdTabs()

export type MtdTransaction = {
  id: string
  merchant: string
  category: string
  date: string
  amount: number
  initials: string
  color: string
}

export const MTD_DOWNLOAD_TRANSACTIONS = {
  lastUpdated: 'Today, 09:42',
  quarterTotal: 342,
  showingCount: 8,
} as const

export const MTD_TRANSACTIONS: MtdTransaction[] = [
  {
    id: '1',
    merchant: 'Screwfix',
    category: 'Equipment',
    date: '24 Apr 2024',
    amount: -42.8,
    initials: 'SF',
    color: '#00539F',
  },
  {
    id: '2',
    merchant: 'Shell',
    category: 'Fuel',
    date: '23 Apr 2024',
    amount: -68.5,
    initials: 'SH',
    color: '#FFD500',
  },
  {
    id: '3',
    merchant: 'Amazon',
    category: 'Supplies',
    date: '22 Apr 2024',
    amount: -129.99,
    initials: 'AM',
    color: '#FF9900',
  },
  {
    id: '4',
    merchant: 'HMRC VAT Refund',
    category: 'Refund',
    date: '21 Apr 2024',
    amount: 214.0,
    initials: 'HM',
    color: '#1D4ED8',
  },
  {
    id: '5',
    merchant: 'Tesco',
    category: 'Supplies',
    date: '20 Apr 2024',
    amount: -34.2,
    initials: 'TE',
    color: '#005A9C',
  },
  {
    id: '6',
    merchant: 'British Gas',
    category: 'Utilities',
    date: '19 Apr 2024',
    amount: -156.0,
    initials: 'BG',
    color: '#0066CC',
  },
  {
    id: '7',
    merchant: 'Adobe',
    category: 'Software',
    date: '18 Apr 2024',
    amount: -49.99,
    initials: 'AD',
    color: '#B91C1C',
  },
  {
    id: '8',
    merchant: 'NatWest',
    category: 'Bank fees',
    date: '17 Apr 2024',
    amount: -12.5,
    initials: 'NW',
    color: '#5B2C6F',
  },
]

export type MtdReviewTransaction = MtdTransaction & {
  categoryType: 'expense' | 'income' | 'transfer'
  aiSuggested?: boolean
}

export const MTD_CATEGORISE = {
  total: 342,
  categorised: 299,
  toReview: 43,
  progress: 87,
  showingCount: 8,
} as const

export const MTD_REVIEW_TRANSACTIONS: MtdReviewTransaction[] = [
  {
    id: '1',
    merchant: 'Screwfix',
    category: 'Equipment',
    date: '24 Apr 2024',
    amount: -42.8,
    initials: 'SF',
    color: '#00539F',
    categoryType: 'expense',
  },
  {
    id: '2',
    merchant: 'Shell',
    category: 'Fuel',
    date: '23 Apr 2024',
    amount: -68.5,
    initials: 'SH',
    color: '#FFD500',
    categoryType: 'expense',
  },
  {
    id: '3',
    merchant: 'Amazon',
    category: 'Supplies',
    date: '22 Apr 2024',
    amount: -129.99,
    initials: 'AM',
    color: '#FF9900',
    categoryType: 'expense',
  },
  {
    id: '4',
    merchant: 'HMRC VAT Refund',
    category: 'VAT Refund',
    date: '21 Apr 2024',
    amount: 214.0,
    initials: 'HM',
    color: '#1D4ED8',
    categoryType: 'income',
  },
  {
    id: '5',
    merchant: 'Tesco',
    category: 'Groceries',
    date: '20 Apr 2024',
    amount: -34.2,
    initials: 'TE',
    color: '#005A9C',
    categoryType: 'expense',
  },
  {
    id: '6',
    merchant: 'British Gas',
    category: 'Utilities',
    date: '19 Apr 2024',
    amount: -156.0,
    initials: 'BG',
    color: '#0066CC',
    categoryType: 'expense',
  },
  {
    id: '7',
    merchant: 'Adobe',
    category: 'Software',
    date: '18 Apr 2024',
    amount: -49.99,
    initials: 'AD',
    color: '#B91C1C',
    categoryType: 'expense',
  },
  {
    id: '8',
    merchant: 'NatWest',
    category: 'Bank fees',
    date: '17 Apr 2024',
    amount: -12.5,
    initials: 'NW',
    color: '#5B2C6F',
    categoryType: 'transfer',
  },
]

export const MTD_CATEGORY_FILTERS = [
  { id: 'to-review', label: 'To review', count: 43, accent: MTD_TOKENS.orange },
  { id: 'all', label: 'All', accent: MTD_TOKENS.textMuted },
  { id: 'income', label: 'Income', accent: MTD_TOKENS.green },
  { id: 'expenses', label: 'Expenses', accent: MTD_TOKENS.orange },
  { id: 'transfers', label: 'Transfers', accent: MTD_TOKENS.blue },
] as const
