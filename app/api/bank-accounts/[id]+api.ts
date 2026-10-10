import { jsonError, requireAuth } from '~/server/apiHelpers'

import type { Endpoint } from 'one'

function getAccountId(request: Request) {
  const match = new URL(request.url).pathname.match(/\/api\/bank-accounts\/([^/]+)$/)
  return match?.[1]
}

export const PATCH: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const accountId = getAccountId(request)
    if (!accountId) {
      return jsonError('Missing bank account id', 400)
    }

    const body = (await request.json()) as {
      institutionName?: string | null
      accountName?: string | null
    }

    const { updateBankAccount } =
      await import('~/features/bankAccounts/server/bankAccountService')
    const account = await updateBankAccount(authData.id, accountId, {
      institutionName: body.institutionName,
      accountName: body.accountName,
    })

    return Response.json({ account })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[bank-accounts] update account error', error)
    const message =
      error instanceof Error ? error.message : 'Failed to update bank account'
    const status = message === 'Bank account not found' ? 404 : 500
    return jsonError(message, status)
  }
}

export const DELETE: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const accountId = getAccountId(request)
    if (!accountId) {
      return jsonError('Missing bank account id', 400)
    }

    const { deleteBankAccount } =
      await import('~/features/bankAccounts/server/bankAccountService')
    const result = await deleteBankAccount(authData.id, accountId)
    return Response.json(result)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[bank-accounts] delete account error', error)
    const message =
      error instanceof Error ? error.message : 'Failed to delete bank account'
    const status = message === 'Bank account not found' ? 404 : 500
    return jsonError(message, status)
  }
}
