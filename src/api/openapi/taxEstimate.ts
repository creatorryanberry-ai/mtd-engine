import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const estimateResponseSchema = v.looseObject({
  taxYearStart: v.string(),
  jurisdiction: v.string(),
  useProjection: v.boolean(),
  answers: v.looseObject({}),
  business: v.looseObject({
    profitUsedPounds: v.number(),
    cisDeductedPounds: v.number(),
    propertyFromRecords: v.boolean(),
  }),
  calculation: v.looseObject({
    taxYearStart: v.string(),
    taxYearLabel: v.string(),
    incomeTax: v.number(),
    class4Ni: v.number(),
    totalLiability: v.number(),
    alreadyPaid: v.number(),
    stillToPay: v.number(),
    disclaimer: v.string(),
  }),
  updatedAt: v.string(),
})

registerRoute({
  method: 'GET',
  path: '/api/tax-estimate',
  summary: 'Get estimated tax',
  description:
    'Returns the authenticated user’s estimated tax profile, business snapshot, and calculation for a tax year. This is an in-app estimate, not an HMRC calculation or a Self Assessment submission.',
  tags: ['tax-estimate'],
  security: 'bearer',
  input: v.object({
    taxYearStart: v.optional(v.string()),
  }),
  output: estimateResponseSchema,
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'PATCH',
  path: '/api/tax-estimate',
  summary: 'Update estimated tax answers',
  description:
    'Saves estimator answers for the authenticated user and tax year, then returns a recalculated estimate.',
  tags: ['tax-estimate'],
  security: 'bearer',
  input: v.looseObject({
    taxYearStart: v.string(),
    jurisdiction: v.optional(v.string()),
    useProjection: v.optional(v.boolean()),
    answers: v.optional(v.looseObject({})),
  }),
  output: estimateResponseSchema,
  errorResponses: unauthorizedErrorResponse,
})
