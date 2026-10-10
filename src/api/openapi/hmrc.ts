import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const unauthorizedErrorResponse = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const hmrcBusinessSchema = v.object({
  businessId: v.string(),
  typeOfBusiness: v.string(),
  tradingName: v.nullable(v.string()),
})

const hmrcObligationSchema = v.object({
  periodStartDate: v.string(),
  periodEndDate: v.string(),
  dueDate: v.string(),
  status: v.picklist(['open', 'fulfilled']),
  receivedDate: v.nullable(v.string()),
})

const hmrcConnectionStatusSchema = v.object({
  configured: v.boolean(),
  connected: v.boolean(),
  environment: v.picklist(['sandbox', 'production']),
  nino: v.nullable(v.string()),
  businessId: v.nullable(v.string()),
  businessName: v.nullable(v.string()),
  connectedAt: v.nullable(v.string()),
  tokenExpiresAt: v.nullable(v.string()),
})

const hmrcTaxEstimateSchema = v.object({
  calculationId: v.string(),
  taxYear: v.string(),
  incomeTaxAmount: v.nullable(v.number()),
  totalIncomeTaxAndNicsDue: v.nullable(v.number()),
  totalTaxDeducted: v.nullable(v.number()),
  totalNicAmount: v.nullable(v.number()),
  disclaimer: v.string(),
  hmrcAccountUrl: v.string(),
  retrievedAt: v.string(),
})

registerRoute({
  method: 'POST',
  path: '/api/hmrc/authorize',
  summary: 'Start HMRC authorization',
  description:
    'Creates an OAuth authorization request for the authenticated user and returns the HMRC authorization URL.',
  tags: ['hmrc'],
  security: 'bearer',
  input: v.object({
    nino: v.string(),
    platform: v.optional(v.picklist(['web', 'native'])),
    returnTo: v.optional(v.string()),
  }),
  output: v.object({
    authorizationUrl: v.string(),
    state: v.string(),
    redirectUri: v.string(),
    nino: v.string(),
  }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/hmrc/businesses',
  summary: 'List HMRC businesses',
  description:
    'Lists the authenticated user’s self-employment businesses available through HMRC.',
  tags: ['hmrc'],
  security: 'bearer',
  output: v.object({ businesses: v.array(hmrcBusinessSchema) }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'POST',
  path: '/api/hmrc/businesses',
  summary: 'Select HMRC business',
  description: 'Stores the selected HMRC business for the authenticated user.',
  tags: ['hmrc'],
  security: 'bearer',
  input: v.object({
    businessId: v.string(),
    businessName: v.optional(v.nullable(v.string())),
  }),
  output: v.object({ businessId: v.string() }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/hmrc/callback',
  summary: 'Handle HMRC authorization callback',
  description:
    'Public OAuth redirect endpoint. Completes authorization when possible and redirects to the configured application return URL.',
  tags: ['hmrc'],
  security: 'public',
  input: v.object({
    code: v.string(),
    state: v.string(),
    error: v.optional(v.string()),
  }),
  successStatus: 302,
})

registerRoute({
  method: 'POST',
  path: '/api/hmrc/callback',
  summary: 'Exchange HMRC authorization code',
  description:
    'Completes HMRC authorization for the authenticated user with an OAuth code and state.',
  tags: ['hmrc'],
  security: 'bearer',
  input: v.object({
    code: v.string(),
    state: v.string(),
  }),
  output: v.object({
    connected: v.literal(true),
    nino: v.string(),
  }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'DELETE',
  path: '/api/hmrc/disconnect',
  summary: 'Disconnect HMRC',
  description: 'Removes the authenticated user’s HMRC connection.',
  tags: ['hmrc'],
  security: 'bearer',
  output: v.object({ disconnected: v.literal(true) }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/hmrc/obligations',
  summary: 'Get next HMRC obligation',
  description:
    'Returns the authenticated user’s next open HMRC Income Tax obligation, or null when none are open.',
  tags: ['hmrc'],
  security: 'bearer',
  output: v.object({ obligation: v.nullable(hmrcObligationSchema) }),
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/hmrc/status',
  summary: 'Get HMRC connection status',
  description:
    'Returns the authenticated user’s HMRC connection status and selected business details.',
  tags: ['hmrc'],
  security: 'bearer',
  output: hmrcConnectionStatusSchema,
  errorResponses: unauthorizedErrorResponse,
})

registerRoute({
  method: 'GET',
  path: '/api/hmrc/tax-estimate',
  summary: 'Get HMRC tax estimate',
  description:
    'Triggers and retrieves an in-year HMRC tax calculation for the selected tax year.',
  tags: ['hmrc'],
  security: 'bearer',
  input: v.object({
    taxYearStart: v.optional(v.string()),
  }),
  output: hmrcTaxEstimateSchema,
  errorResponses: unauthorizedErrorResponse,
})
