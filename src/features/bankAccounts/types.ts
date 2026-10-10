export type MtdTransactionDto = {
  id: string
  merchant: string
  displayName?: string
  category: string
  hmrcCategory: string
  categorySource: 'rule' | 'heuristic' | 'user' | 'uncategorised'
  confidence: 'high' | 'low'
  needsReview: boolean
  categoryType: 'income' | 'expense' | 'transfer' | 'personal'
  date: string
  dateIso: string
  amount: number
  initials: string
  color: string
  pending: boolean
  isManual: boolean
  privateUsePercent?: number | null
  attachmentUrl?: string | null
}
