import { jsonError, requireAuth } from '~/server/apiHelpers'

import type { Endpoint } from 'one'
import type {
  TransactionFilter,
  TransactionSort,
} from '~/features/categorisation/server/categorisationService'

const VALID_FILTERS: TransactionFilter[] = [
  'to-review',
  'all',
  'income',
  'expenses',
  'transfers',
]

const VALID_SORTS: TransactionSort[] = ['newest', 'oldest']

export const GET: Endpoint = async (request) => {
  try {
    const authData = await requireAuth(request)
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get('limit') || 50)
    const offset = Number(url.searchParams.get('offset') || 0)
    const filterParam = url.searchParams.get('filter') || 'all'
    const sortParam = url.searchParams.get('sort') || 'newest'

    const filter = VALID_FILTERS.includes(filterParam as TransactionFilter)
      ? (filterParam as TransactionFilter)
      : 'all'
    const sort = VALID_SORTS.includes(sortParam as TransactionSort)
      ? (sortParam as TransactionSort)
      : 'newest'
    const excludeReviewed = url.searchParams.get('excludeReviewed') === 'true'
    const reviewedOnly = url.searchParams.get('reviewedOnly') === 'true'
    const bankAccountId = url.searchParams.get('bankAccountId') || undefined

    const { getTransactionsForUser } =
      await import('~/features/bankAccounts/server/transactionsService')
    const result = await getTransactionsForUser(
      authData.id,
      limit,
      offset,
      filter,
      sort,
      excludeReviewed,
      reviewedOnly,
      bankAccountId,
    )
    return Response.json(result)
  } catch (error) {
    if (error instanceof Response) return error
    console.error('[transactions] search error', error)
    return jsonError(
      error instanceof Error ? error.message : 'Failed to load transactions',
      500,
    )
  }
}
