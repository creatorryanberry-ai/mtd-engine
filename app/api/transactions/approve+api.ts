import { jsonError, requireAuth } from '~/server/apiHelpers'
import {
  approveTransaction,
  getFriendlyNameForMerchant,
  getPrivateUsePercentForMerchant,
  getRulesForUser,
} from '~/features/categorisation/server/categorisationService'
import { mapMtdTransactionDto } from '~/features/bankAccounts/utils/mapMtdTransactionDto'
import { getTransactionDisplayName } from '~/features/mtd/utils/formatTransactionDisplay'

import type { Endpoint } from 'one'

export const POST: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as { id?: string; ids?: string[] }
    const rules = await getRulesForUser(authData.id)

    const ids = body.ids?.length ? body.ids : body.id ? [body.id] : []

    if (ids.length === 0) {
      return jsonError('Transaction id is required')
    }

    const transactions = []

    for (const id of ids) {
      const updated = await approveTransaction(authData.id, id)
      if (!updated) {
        return jsonError(`Transaction not found: ${id}`, 404)
      }
      const friendlyName = getFriendlyNameForMerchant(
        rules,
        updated.merchantName,
        updated.bankAccountId,
      )
      const privateUsePercent = getPrivateUsePercentForMerchant(
        rules,
        updated.merchantName,
        updated.hmrcCategory,
        updated.bankAccountId,
      )
      const displayName = friendlyName ?? getTransactionDisplayName(updated.merchantName)
      transactions.push(mapMtdTransactionDto(updated, { displayName, privateUsePercent }))
    }

    if (transactions.length === 1) {
      return Response.json({ transaction: transactions[0], transactions })
    }

    return Response.json({ transactions })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[transactions] approve error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to approve transaction',
      500,
    )
  }
}
