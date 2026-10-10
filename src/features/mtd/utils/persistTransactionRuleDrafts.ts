import type { TransactionRuleDraft } from '~/features/mtd/utils/transactionEditRules'
import { normalizeRulePrivateUsePercent } from '~/features/mtd/categories/transactionEditCategories'

export type TransactionEditAcceptInput = {
  hmrcCategory: string
  transactionIds: string[]
  rememberForFuture: boolean
  friendlyName: string
  ruleDrafts: TransactionRuleDraft[]
  privateUsePercent?: number | null
}

export function buildTransactionAcceptIds(
  leadId: string,
  matchedRecordIds: string[],
  selectedMatchedIds: Set<string>,
) {
  const ids = [leadId]

  for (const id of matchedRecordIds) {
    if (selectedMatchedIds.has(id)) {
      ids.push(id)
    }
  }

  return ids
}

export function buildRuleDraftsForAccept({
  ruleDrafts,
  friendlyName,
  hmrcCategory,
  privateUsePercent,
}: Pick<
  TransactionEditAcceptInput,
  'ruleDrafts' | 'friendlyName' | 'hmrcCategory' | 'privateUsePercent'
>) {
  const activeDrafts = ruleDrafts.filter(
    (draft: TransactionRuleDraft) => !draft.deleted && draft.matchValue.trim(),
  )

  if (activeDrafts.length === 0) {
    return []
  }

  const normalizedPrivateUsePercent = normalizeRulePrivateUsePercent(
    hmrcCategory,
    privateUsePercent,
  )
  const [primary, ...rest] = activeDrafts

  return [
    {
      ...primary,
      friendlyName: friendlyName || primary.friendlyName,
      hmrcCategory,
      privateUsePercent: normalizedPrivateUsePercent,
    },
    ...rest.map((draft) => ({
      ...draft,
      privateUsePercent: normalizeRulePrivateUsePercent(
        draft.hmrcCategory,
        draft.privateUsePercent,
      ),
    })),
  ]
}

export async function persistTransactionRuleDrafts(
  persistDraft: (drafts: TransactionRuleDraft[]) => Promise<void>,
  input: Pick<
    TransactionEditAcceptInput,
    'ruleDrafts' | 'friendlyName' | 'hmrcCategory' | 'privateUsePercent'
  >,
) {
  const activeToSave = buildRuleDraftsForAccept(input)
  const deletedDrafts = input.ruleDrafts.filter(
    (draft: TransactionRuleDraft) => draft.deleted,
  )
  const draftsToPersist = [...activeToSave, ...deletedDrafts]

  if (draftsToPersist.length === 0) return
  await persistDraft(draftsToPersist)
}
