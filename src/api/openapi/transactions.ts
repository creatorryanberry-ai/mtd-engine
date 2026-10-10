import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

import { mtdTransactionDtoSchema } from './schemas/mtdTransactionDto'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const nonEmptyStringSchema = v.pipe(v.string(), v.minLength(1))
const manualTransactionNameSchema = v.pipe(
  nonEmptyStringSchema,
  v.regex(/\S/),
  v.description('Must contain at least one non-whitespace character.'),
)
const manualTransactionAmountSchema = v.pipe(
  v.number(),
  v.notValue(0),
  v.description('A finite, non-zero amount.'),
)

const manualTransactionFields = {
  name: manualTransactionNameSchema,
  details: v.optional(v.nullable(v.string())),
  date: nonEmptyStringSchema,
  amount: manualTransactionAmountSchema,
  attachmentUrl: v.optional(v.nullable(v.string())),
}

registerRoute({
  method: 'PATCH',
  path: '/api/transactions',
  summary: 'Update a transaction category',
  description:
    'Updates the HMRC category for a transaction owned by the authenticated user.',
  tags: ['transactions'],
  security: 'bearer',
  input: v.object({
    id: v.string(),
    hmrcCategory: v.string(),
  }),
  output: v.object({ transaction: mtdTransactionDtoSchema }),
  examples: {
    request: {
      id: 'txn_01',
      hmrcCategory: 'office_costs',
    },
  },
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/transactions/approve',
  summary: 'Approve transactions',
  description:
    'Marks one transaction or a non-empty list of transactions as approved for the authenticated user.',
  tags: ['transactions'],
  security: 'bearer',
  input: v.union([
    v.object({ id: nonEmptyStringSchema }),
    v.object({ ids: v.pipe(v.array(v.string()), v.minLength(1)) }),
  ]),
  output: v.object({
    transaction: v.optional(mtdTransactionDtoSchema),
    transactions: v.array(mtdTransactionDtoSchema),
  }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/transactions/manual',
  summary: 'Create a manual transaction',
  description:
    'Creates a manual transaction in the specified bank account for the authenticated user.',
  tags: ['transactions'],
  security: 'bearer',
  input: v.object({
    bankAccountId: v.string(),
    ...manualTransactionFields,
    hmrcCategory: v.optional(v.nullable(v.string())),
  }),
  output: v.object({ transaction: mtdTransactionDtoSchema }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/transactions/manual',
  summary: 'Update a manual transaction',
  description:
    'Replaces the editable fields of a manual transaction owned by the authenticated user.',
  tags: ['transactions'],
  security: 'bearer',
  input: v.object({
    id: v.string(),
    ...manualTransactionFields,
  }),
  output: v.object({ transaction: mtdTransactionDtoSchema }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'DELETE',
  path: '/api/transactions/manual',
  summary: 'Delete a manual transaction',
  description: 'Deletes a manual transaction owned by the authenticated user.',
  tags: ['transactions'],
  security: 'bearer',
  inputLocation: 'body',
  input: v.object({ id: v.string() }),
  output: v.object({ deleted: v.literal(true) }),
  errorResponses: unauthorizedErrorResponse,
})
