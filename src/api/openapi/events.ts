import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const lifecycleEventSchema = v.object({
  type: v.picklist(['connected', 'heartbeat', 'error']),
  at: v.optional(v.number()),
  message: v.optional(v.string()),
})

const entityChangeEventSchema = v.looseObject({
  entity: v.string(),
  id: v.optional(v.string()),
  status: v.optional(v.string()),
})

registerRoute({
  method: 'GET',
  path: '/api/events',
  summary: 'Subscribe to user events (SSE)',
  description:
    'Authenticated server-sent events stream. Sends a connected event, periodic heartbeats, and JSON payloads when user entities change. Not for Scalar Try-it long-polling — use EventSource or curl -N.',
  tags: ['events'],
  security: 'bearer',
  successContentType: 'text/event-stream',
  output: v.union([lifecycleEventSchema, entityChangeEventSchema]),
  examples: {
    response: { type: 'connected' },
  },
  errorResponses: [
    { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
  ],
})
