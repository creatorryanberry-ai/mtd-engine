import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { listResponseSchema, mtdTransactionSchema } from '~/contract'
import { listMtdTransactions } from '~/features/api/server/transactions'
import { jsonError, requireAuth } from '~/server/apiHelpers'
import {
  getFriendlyNameForMerchant,
  getPrivateUsePercentForMerchant,
  getRulesForUser,
  updateTransactionCategory,
} from '~/features/categorisation/server/categorisationService'
import { getHmrcCategory } from '~/features/mtd/categories/hmrcCategories'
import { mapMtdTransactionDto } from '~/features/bankAccounts/utils/mapMtdTransactionDto'
import { getTransactionDisplayName } from '~/features/mtd/utils/formatTransactionDisplay'

import type { Endpoint } from 'one'

const querySchema = v.object({
  limit: v.optional(v.pipe(v.string(), v.transform(Number))),
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/transactions',
  summary: 'List MTD transactions for the current user',
  tags: ['transactions'],
  input: querySchema,
  output: listResponseSchema(mtdTransactionSchema),
  handler: async (input, { request }) => {
    const auth = await requireApiAuth(request)
    const items = await listMtdTransactions({
      userId: auth.id,
      limit: input.limit != null ? Number(input.limit) : undefined,
    })
    return { items }
  },
})

export const PATCH: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const body = (await request.json()) as { id?: string; hmrcCategory?: string }

    if (!body.id || !body.hmrcCategory) {
      return jsonError('id and hmrcCategory are required')
    }

    if (!getHmrcCategory(body.hmrcCategory)) {
      return jsonError('Invalid HMRC category')
    }

    const updated = await updateTransactionCategory(
      authData.id,
      body.id,
      body.hmrcCategory,
    )

    if (!updated) {
      return jsonError('Transaction not found', 404)
    }

    const rules = await getRulesForUser(authData.id)
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

    return Response.json({
      transaction: mapMtdTransactionDto(updated, { displayName, privateUsePercent }),
    })
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[transactions] patch error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to update transaction',
      500,
    )
  }
}
