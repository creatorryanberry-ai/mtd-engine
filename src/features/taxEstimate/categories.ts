import type { EstimateCategoryId } from './types'

export const ESTIMATE_CATEGORIES: Array<{
  id: EstimateCategoryId
  title: string
  question: string
  icon:
    | 'briefcase'
    | 'bank'
    | 'chart'
    | 'house'
    | 'chair'
    | 'family'
    | 'graduation'
    | 'gift'
    | 'tag'
    | 'globe'
    | 'ellipsis'
  iconBg: string
  iconColor: string
}> = [
  {
    id: 'employment',
    title: 'Employment',
    question: 'Did you have a job as well as your business?',
    icon: 'briefcase',
    iconBg: 'rgba(13, 148, 136, 0.14)',
    iconColor: '#0F766E',
  },
  {
    id: 'savings',
    title: 'Savings',
    question: 'Did you earn interest on savings?',
    icon: 'bank',
    iconBg: 'rgba(21, 128, 61, 0.14)',
    iconColor: '#166534',
  },
  {
    id: 'investments',
    title: 'Investments',
    question: 'Did you receive dividends or sell investments?',
    icon: 'chart',
    iconBg: 'rgba(126, 34, 206, 0.14)',
    iconColor: '#7E22CE',
  },
  {
    id: 'property',
    title: 'Property',
    question: 'Did you receive rental income?',
    icon: 'house',
    iconBg: 'rgba(180, 83, 9, 0.14)',
    iconColor: '#B45309',
  },
  {
    id: 'pensions',
    title: 'Pensions',
    question: 'Did you receive a pension?',
    icon: 'chair',
    iconBg: 'rgba(37, 99, 235, 0.14)',
    iconColor: '#2563EB',
  },
  {
    id: 'family',
    title: 'Family',
    question: 'Did you or your partner receive Child Benefit?',
    icon: 'family',
    iconBg: 'rgba(220, 38, 38, 0.14)',
    iconColor: '#DC2626',
  },
  {
    id: 'studentLoan',
    title: 'Student loan',
    question: 'Are you repaying a student or postgraduate loan?',
    icon: 'graduation',
    iconBg: 'rgba(30, 64, 175, 0.14)',
    iconColor: '#1E40AF',
  },
  {
    id: 'reliefs',
    title: 'Things that reduce tax',
    question: 'Pension payments, Gift Aid or other reliefs?',
    icon: 'gift',
    iconBg: 'rgba(13, 148, 136, 0.14)',
    iconColor: '#0F766E',
  },
  {
    id: 'capitalGains',
    title: 'Sold something valuable',
    question: 'Did you sell property, shares, crypto or another asset?',
    icon: 'tag',
    iconBg: 'rgba(234, 88, 12, 0.14)',
    iconColor: '#EA580C',
  },
  {
    id: 'foreignIncome',
    title: 'Foreign income',
    question: 'Did you receive any income from outside the UK?',
    icon: 'globe',
    iconBg: 'rgba(126, 34, 206, 0.14)',
    iconColor: '#7E22CE',
  },
  {
    id: 'otherIncome',
    title: 'Something else',
    question: "Any other income or things we haven't covered?",
    icon: 'ellipsis',
    iconBg: 'rgba(107, 114, 128, 0.14)',
    iconColor: '#6B7280',
  },
]
