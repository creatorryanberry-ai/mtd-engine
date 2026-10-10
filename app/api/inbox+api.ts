import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { listInboxDocuments } from '~/features/inbox/server/inboxDocumentService'

import type { Endpoint } from 'one'

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

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/inbox',
  summary: 'List inbox documents waiting to be processed',
  tags: ['inbox'],
  output: v.object({
    items: v.array(inboxItemSchema),
    waitingCount: v.number(),
    notices: v.array(inboxNoticeSchema),
  }),
  handler: async (_input, { request }) => {
    const auth = await requireApiAuth(request)
    return listInboxDocuments(auth.id)
  },
})
