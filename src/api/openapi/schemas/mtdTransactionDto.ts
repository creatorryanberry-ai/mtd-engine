import * as v from 'valibot'

export const mtdTransactionDtoSchema = v.object({
  id: v.string(),
  merchant: v.string(),
  displayName: v.optional(v.string()),
  category: v.string(),
  hmrcCategory: v.string(),
  categorySource: v.picklist(['rule', 'heuristic', 'user', 'uncategorised']),
  confidence: v.picklist(['high', 'low']),
  needsReview: v.boolean(),
  categoryType: v.picklist(['income', 'expense', 'transfer', 'personal']),
  date: v.string(),
  dateIso: v.string(),
  amount: v.number(),
  initials: v.string(),
  color: v.string(),
  pending: v.boolean(),
  isManual: v.boolean(),
  privateUsePercent: v.optional(v.nullable(v.number())),
  attachmentUrl: v.optional(v.nullable(v.string())),
})
