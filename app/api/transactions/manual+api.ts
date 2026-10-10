import { jsonError, requireAuth } from '~/server/apiHelpers'
import {
  createManualTransaction,
  deleteManualTransaction,
  updateManualTransaction,
} from '~/features/categorisation/server/manualTransactionService'
import { mapMtdTransactionDto } from '~/features/bankAccounts/utils/mapMtdTransactionDto'

import type { Endpoint } from 'one'

type ManualTransactionBody = {
  bankAccountId?: string
  id?: string
  name?: string
  details?: string | null
  date?: string
  amount?: number
  attachmentUrl?: string | null
  hmrcCategory?: string | null
}

function parseBody(body: ManualTransactionBody):
  | { error: string }
  | {
      input: {
        name: string
        details: string | null
        date: string
        amount: number
        attachmentUrl: string | null
      }
    } {
  if (!body.name?.trim()) {
    return { error: 'name is required' as const }
  }
  if (!body.date) {
    return { error: 'date is required' as const }
  }
  if (body.amount == null || !Number.isFinite(body.amount) || body.amount === 0) {
    return { error: 'amount is required' as const }
  }

  return {
    input: {
      name: body.name,
      details: body.details ?? null,
      date: body.date,
      amount: body.amount,
      attachmentUrl: body.attachmentUrl?.trim() || null,
    },
  }
}

export const POST: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as ManualTransactionBody

    if (!body.bankAccountId) {
      return jsonError('bankAccountId is required')
    }

    const parsed = parseBody(body)
    if ('error' in parsed) {
      return jsonError(parsed.error)
    }

    const created = await createManualTransaction(authData.id, {
      bankAccountId: body.bankAccountId,
      name: parsed.input.name,
      details: parsed.input.details,
      date: parsed.input.date,
      amount: parsed.input.amount,
      attachmentUrl: parsed.input.attachmentUrl,
      hmrcCategory: body.hmrcCategory?.trim() || undefined,
    })

    return Response.json({
      transaction: mapMtdTransactionDto(created),
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[transactions/manual] post error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to create manual transaction',
      500,
    )
  }
}

export const PATCH: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as ManualTransactionBody

    if (!body.id) {
      return jsonError('id is required')
    }

    const parsed = parseBody(body)
    if ('error' in parsed) {
      return jsonError(parsed.error)
    }

    const updated = await updateManualTransaction(authData.id, body.id, {
      name: parsed.input.name,
      details: parsed.input.details,
      date: parsed.input.date,
      amount: parsed.input.amount,
      attachmentUrl: parsed.input.attachmentUrl,
    })

    if (!updated) {
      return jsonError('Transaction not found', 404)
    }

    return Response.json({
      transaction: mapMtdTransactionDto(updated),
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[transactions/manual] patch error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to update manual transaction',
      500,
    )
  }
}

export const DELETE: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as { id?: string }

    if (!body.id) {
      return jsonError('id is required')
    }

    const deleted = await deleteManualTransaction(authData.id, body.id)
    if (!deleted) {
      return jsonError('Transaction not found', 404)
    }

    return Response.json({ deleted: true })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[transactions/manual] delete error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to delete manual transaction',
      500,
    )
  }
}
