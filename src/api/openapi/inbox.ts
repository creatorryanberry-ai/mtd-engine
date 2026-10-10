import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'

const unauthorized = [
  { status: 401, description: 'Unauthorized', schema: errorResponseSchema },
]

const inboxItemSchema = v.object({
  id: v.string(),
  originalFileName: v.string(),
  mimeType: v.string(),
  fileSize: v.number(),
  source: v.string(),
  status: v.string(),
  receivedAt: v.string(),
  fromAddress: v.nullable(v.string()),
  subject: v.nullable(v.string()),
})

const inboxNoticeSchema = v.object({
  id: v.string(),
  status: v.string(),
  receivedAt: v.string(),
  fromAddress: v.nullable(v.string()),
  subject: v.nullable(v.string()),
  errorMessage: v.nullable(v.string()),
})

const addressSchema = v.object({
  id: v.string(),
  emailAddress: v.string(),
  isActive: v.boolean(),
  createdAt: v.string(),
})

registerRoute({
  method: 'GET',
  path: '/api/inbox',
  summary: 'List inbox documents waiting to be processed',
  tags: ['inbox'],
  security: 'bearer',
  output: v.object({
    items: v.array(inboxItemSchema),
    waitingCount: v.number(),
    notices: v.array(inboxNoticeSchema),
  }),
  errorResponses: unauthorized,
})

registerRoute({
  method: 'GET',
  path: '/api/inbox/address',
  summary: 'Get or create the current user’s inbound email address',
  tags: ['inbox'],
  security: 'bearer',
  output: v.object({ address: addressSchema }),
  errorResponses: unauthorized,
})

registerRoute({
  method: 'POST',
  path: '/api/inbox/address/regenerate',
  summary: 'Revoke the current inbound address and issue a new one',
  tags: ['inbox'],
  security: 'bearer',
  output: v.object({ address: addressSchema }),
  errorResponses: unauthorized,
})

registerRoute({
  method: 'GET',
  path: '/api/inbox/{id}',
  summary: 'Get an inbox document owned by the current user',
  tags: ['inbox'],
  security: 'bearer',
  output: v.object({
    item: v.object({
      id: v.string(),
      originalFileName: v.string(),
      mimeType: v.string(),
      fileSize: v.number(),
      source: v.string(),
      status: v.string(),
      receivedAt: v.string(),
      fromAddress: v.nullable(v.string()),
      subject: v.nullable(v.string()),
      previewUrl: v.nullable(v.string()),
      mtdTransactionId: v.nullable(v.string()),
      errorMessage: v.nullable(v.string()),
    }),
  }),
  errorResponses: [
    ...unauthorized,
    { status: 404, description: 'Not found', schema: errorResponseSchema },
  ],
})

registerRoute({
  method: 'POST',
  path: '/api/inbox/{id}/ignore',
  summary: 'Ignore an inbox document',
  tags: ['inbox'],
  security: 'bearer',
  output: v.object({ ok: v.literal(true) }),
  errorResponses: [
    ...unauthorized,
    { status: 404, description: 'Not found', schema: errorResponseSchema },
  ],
})

registerRoute({
  method: 'POST',
  path: '/api/inbox/{id}/processed',
  summary: 'Mark an inbox document as processed after saving a transaction',
  tags: ['inbox'],
  security: 'bearer',
  input: v.object({ mtdTransactionId: v.string() }),
  output: v.object({ ok: v.literal(true) }),
  errorResponses: [
    ...unauthorized,
    { status: 404, description: 'Not found', schema: errorResponseSchema },
  ],
})

registerRoute({
  method: 'POST',
  path: '/api/inbox/notices/{id}/delete',
  summary: 'Delete a no-attachment inbox notice',
  tags: ['inbox'],
  security: 'bearer',
  output: v.object({ ok: v.literal(true) }),
  errorResponses: [
    ...unauthorized,
    { status: 404, description: 'Not found', schema: errorResponseSchema },
  ],
})

registerRoute({
  method: 'POST',
  path: '/api/inbound-email/postmark',
  summary: 'Postmark inbound email webhook',
  tags: ['inbox'],
  security: 'public',
  output: v.object({
    ok: v.literal(true),
    status: v.string(),
  }),
})
