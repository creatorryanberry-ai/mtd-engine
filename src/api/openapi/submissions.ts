import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

import {
  quarterlySummarySchema,
  reviewFinancialSummarySchema,
  submissionsOverviewSchema,
  submitQuarterlyResultSchema,
} from './schemas/submissions'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const submissionQuerySchema = v.object({
  quarter: v.optional(v.picklist(['Q1', 'Q2', 'Q3', 'Q4'])),
  taxYearStart: v.optional(v.string()),
})

registerRoute({
  method: 'GET',
  path: '/api/submissions/overview',
  summary: 'Get submissions overview',
  description:
    'Returns the authenticated user’s quarterly submission progress and year-end deadline for a tax year.',
  tags: ['submissions'],
  security: 'bearer',
  input: v.object({ taxYearStart: v.optional(v.string()) }),
  output: submissionsOverviewSchema,
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/submissions/quarterly',
  summary: 'Submit a quarterly update',
  description:
    'Submits the authenticated user’s ready quarterly update to HMRC when connected, otherwise records a local mock submission.',
  tags: ['submissions'],
  security: 'bearer',
  input: v.object({
    quarterId: v.optional(v.picklist(['Q1', 'Q2', 'Q3', 'Q4'])),
    taxYearStart: v.optional(v.string()),
  }),
  output: submitQuarterlyResultSchema,
  errorResponses: [
    ...unauthorizedErrorResponse,
    {
      status: 400,
      description: 'Submission is not ready',
      schema: errorResponseSchema,
    },
    {
      status: 409,
      description: 'Quarter has already been submitted',
      schema: errorResponseSchema,
    },
  ],
})

registerRoute({
  method: 'DELETE',
  path: '/api/submissions/quarterly',
  summary: 'Delete a quarterly submission',
  description:
    'Deletes a quarterly submission. This is restricted to administrators unless demo authentication is enabled.',
  tags: ['submissions'],
  security: 'bearer',
  input: submissionQuerySchema,
  output: v.object({
    quarterId: v.picklist(['Q1', 'Q2', 'Q3', 'Q4']),
    taxYearStart: v.string(),
  }),
  errorResponses: [
    ...unauthorizedErrorResponse,
    { status: 403, description: 'Admin access required', schema: errorResponseSchema },
    { status: 404, description: 'Submission not found', schema: errorResponseSchema },
  ],
})

registerRoute({
  method: 'GET',
  path: '/api/submissions/quarterly-summary',
  summary: 'Get quarterly submission summary',
  description:
    'Returns the authenticated user’s totals, categories, blockers, and existing submission for a quarter.',
  tags: ['submissions'],
  security: 'bearer',
  input: submissionQuerySchema,
  output: quarterlySummarySchema,
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/submissions/review-summary',
  summary: 'Get financial review summary',
  description:
    'Returns the authenticated user’s income, expenses, CIS, mileage, and private-use review data for a quarter.',
  tags: ['submissions'],
  security: 'bearer',
  input: submissionQuerySchema,
  output: reviewFinancialSummarySchema,
  errorResponses: unauthorizedErrorResponse,
})
