import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const ruleMatchTypeSchema = v.picklist(['contains', 'starts_with', 'exact'])

const categorisationRuleSchema = v.object({
  id: v.string(),
  matchField: v.string(),
  matchType: ruleMatchTypeSchema,
  matchValue: v.string(),
  friendlyName: v.nullable(v.string()),
  hmrcCategory: v.string(),
  hmrcCategoryLabel: v.string(),
  privateUsePercent: v.nullable(v.number()),
  bankAccountIds: v.array(v.string()),
  priority: v.number(),
  createdAt: v.string(),
})

const ruleFieldsSchema = {
  matchValue: v.string(),
  hmrcCategory: v.string(),
  friendlyName: v.optional(v.nullable(v.string())),
  matchType: v.optional(ruleMatchTypeSchema),
  priority: v.optional(v.number()),
  bankAccountIds: v.optional(v.array(v.string())),
  privateUsePercent: v.optional(v.nullable(v.number())),
}

registerRoute({
  method: 'GET',
  path: '/api/categorisation/rules',
  summary: 'List categorisation rules',
  description: 'Returns the authenticated user’s merchant categorisation rules.',
  tags: ['categorisation'],
  security: 'bearer',
  output: v.object({ rules: v.array(categorisationRuleSchema) }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/categorisation/rules',
  summary: 'Create a categorisation rule',
  description:
    'Creates a merchant categorisation rule, or updates the matching merchant rule when upsert is true.',
  tags: ['categorisation'],
  security: 'bearer',
  input: v.object({
    ...ruleFieldsSchema,
    upsert: v.optional(v.boolean()),
  }),
  output: v.object({ rule: categorisationRuleSchema }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/categorisation/rules',
  summary: 'Update a categorisation rule',
  description:
    'Updates the supplied fields of an authenticated user’s categorisation rule.',
  tags: ['categorisation'],
  security: 'bearer',
  input: v.object({
    id: v.string(),
    matchValue: v.optional(v.string()),
    hmrcCategory: v.optional(v.string()),
    friendlyName: v.optional(v.nullable(v.string())),
    matchType: v.optional(ruleMatchTypeSchema),
    priority: v.optional(v.number()),
    bankAccountIds: v.optional(v.array(v.string())),
    privateUsePercent: v.optional(v.nullable(v.number())),
  }),
  output: v.object({ rule: categorisationRuleSchema }),
  errorResponses: [
    ...unauthorizedErrorResponse,
    { status: 404, description: 'Rule not found', schema: errorResponseSchema },
  ],
})

registerRoute({
  method: 'DELETE',
  path: '/api/categorisation/rules',
  summary: 'Delete categorisation rules',
  description:
    'Deletes the rule identified by id, or clears all categorisation rules when id is omitted.',
  tags: ['categorisation'],
  security: 'bearer',
  input: v.object({ id: v.optional(v.string()) }),
  output: v.union([
    v.object({ success: v.literal(true) }),
    v.object({ success: v.literal(true), count: v.number() }),
  ]),
  errorResponses: [
    ...unauthorizedErrorResponse,
    { status: 404, description: 'Rule not found', schema: errorResponseSchema },
  ],
})

registerRoute({
  method: 'GET',
  path: '/api/categorisation/stats',
  summary: 'Get categorisation statistics',
  description:
    'Returns the authenticated user’s categorisation progress, optionally including transaction filter counts.',
  tags: ['categorisation'],
  security: 'bearer',
  input: v.object({
    filters: v.optional(v.boolean()),
    unreviewedOnly: v.optional(v.boolean()),
    bankAccountId: v.optional(v.string()),
  }),
  output: v.object({
    total: v.number(),
    categorised: v.number(),
    toReview: v.number(),
    progress: v.number(),
    filterCounts: v.optional(
      v.object({
        'to-review': v.number(),
        all: v.number(),
        income: v.number(),
        expenses: v.number(),
        transfers: v.number(),
      }),
    ),
  }),
  errorResponses: unauthorizedErrorResponse,
})
