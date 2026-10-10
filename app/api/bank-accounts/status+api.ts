import { jsonError, requireAuth } from '~/server/apiHelpers'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const { getBankAccountsSummary } =
      await import('~/features/bankAccounts/server/transactionsService')
    const status = await getBankAccountsSummary(authData.id)
    return Response.json(status)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[bank-accounts] status error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load bank account status',
      500,
    )
  }
}
