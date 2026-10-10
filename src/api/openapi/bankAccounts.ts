import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

import { mtdTransactionDtoSchema } from './schemas/mtdTransactionDto'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const bankAccountSchema = v.object({
  id: v.string(),
  userId: v.string(),
  bankLinkItemId: v.string(),
  externalAccountId: v.string(),
  institutionName: v.nullable(v.string()),
  accountName: v.nullable(v.string()),
  sortCode: v.nullable(v.string()),
  accountNumber: v.nullable(v.string()),
  accountType: v.nullable(v.string()),
  balance: v.nullable(v.number()),
  currency: v.nullable(v.string()),
  lastSyncedAt: v.nullable(v.string()),
  syncError: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
})

const bankAccountWithStatsSchema = v.intersect([
  bankAccountSchema,
  v.object({
    transactionCount: v.number(),
    unreviewedCount: v.number(),
  }),
])

const bankTransactionsResponseSchema = v.object({
  transactions: v.array(mtdTransactionDtoSchema),
  total: v.number(),
  showing: v.number(),
  offset: v.number(),
  limit: v.number(),
})

const bankAccountsStatusSchema = v.object({
  lastSyncedAt: v.nullable(v.string()),
  transactionCount: v.number(),
  syncWindowDays: v.number(),
})

registerRoute({
  method: 'GET',
  path: '/api/bank-accounts',
  summary: 'List linked bank accounts',
  description:
    'Returns the authenticated user’s visible bank accounts, including transaction and unreviewed counts.',
  tags: ['bank-accounts'],
  security: 'bearer',
  output: v.object({ accounts: v.array(bankAccountWithStatsSchema) }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/bank-accounts/{id}',
  summary: 'Update a linked bank account',
  description:
    'Updates the supplied display names for an authenticated user’s linked bank account.',
  tags: ['bank-accounts'],
  security: 'bearer',
  input: v.object({
    institutionName: v.optional(v.nullable(v.string())),
    accountName: v.optional(v.nullable(v.string())),
  }),
  output: v.object({ account: bankAccountSchema }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'DELETE',
  path: '/api/bank-accounts/{id}',
  summary: 'Delete a linked bank account',
  description:
    'Deletes an authenticated user’s bank account and its transactions, returning the number of transactions removed.',
  tags: ['bank-accounts'],
  security: 'bearer',
  output: v.object({
    deleted: v.literal(true),
    transactionCount: v.number(),
  }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/bank-accounts/status',
  summary: 'Get bank account status',
  description:
    'Returns the authenticated user’s latest sync timestamp, transaction count, and window size.',
  tags: ['bank-accounts'],
  security: 'bearer',
  output: bankAccountsStatusSchema,
  examples: {
    response: {
      lastSyncedAt: '2026-07-30T12:00:00.000Z',
      transactionCount: 42,
      syncWindowDays: 90,
    },
  },
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/transactions/search',
  summary: 'List imported transactions',
  description:
    'Returns a filtered, sorted page of imported transactions for the authenticated user.',
  tags: ['bank-accounts'],
  security: 'bearer',
  input: v.object({
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    filter: v.optional(
      v.picklist(['to-review', 'all', 'income', 'expenses', 'transfers']),
    ),
    sort: v.optional(v.picklist(['newest', 'oldest'])),
    excludeReviewed: v.optional(v.boolean()),
    reviewedOnly: v.optional(v.boolean()),
    bankAccountId: v.optional(v.string()),
  }),
  output: bankTransactionsResponseSchema,
  errorResponses: unauthorizedErrorResponse,
})
