import * as v from 'valibot'

import { registerRoute } from '~/api/registry'

registerRoute({
  method: 'GET',
  path: '/api/health',
  summary: 'API liveness',
  description: 'Returns ok plus deploy sha and environment. Public; use for smoke tests.',
  tags: ['health'],
  security: 'public',
  output: v.object({
    status: v.literal('ok'),
    sha: v.string(),
    env: v.string(),
    timestamp: v.string(),
  }),
  examples: {
    response: {
      status: 'ok',
      sha: 'abc123',
      env: 'production',
      timestamp: '2026-07-30T12:00:00.000Z',
    },
  },
})
