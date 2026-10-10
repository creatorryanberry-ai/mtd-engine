import { jsonError, requireAuth } from '~/server/apiHelpers'

import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const { getBankAccountsForUser } =
      await import('~/features/bankAccounts/server/bankAccountService')
    const accounts = await getBankAccountsForUser(authData.id)
    return Response.json({ accounts })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[bank-accounts] accounts error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load bank accounts',
      500,
    )
  }
}
