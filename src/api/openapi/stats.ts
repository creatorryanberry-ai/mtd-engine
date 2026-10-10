import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const statsRequestSchema = v.variant('action', [
  v.object({
    action: v.literal('capture'),
    event: v.string(),
    properties: v.optional(v.record(v.string(), v.unknown())),
    distinct_id: v.optional(v.string()),
  }),
  v.object({
    action: v.literal('identify'),
    distinct_id: v.string(),
    properties: v.optional(v.record(v.string(), v.unknown())),
  }),
  v.object({
    action: v.literal('decide'),
    distinct_id: v.string(),
  }),
])

registerRoute({
  method: 'POST',
  path: '/api/stats',
  summary: 'Proxy an analytics action',
  description:
    'Public, rate-limited proxy for PostHog capture, identify, and feature-flag decide actions.',
  tags: ['stats'],
  security: 'public',
  input: statsRequestSchema,
  output: v.object({
    ok: v.optional(v.literal(true)),
    featureFlags: v.optional(v.record(v.string(), v.unknown())),
  }),
  errorResponses: [
    {
      status: 400,
      description: 'Invalid analytics request',
      schema: errorResponseSchema,
    },
    { status: 429, description: 'Rate limited', schema: errorResponseSchema },
    { status: 503, description: 'Analytics not configured', schema: errorResponseSchema },
  ],
})
