import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { getInboxDocument } from '~/features/inbox/server/inboxDocumentService'

import type { Endpoint } from 'one'

const detailSchema = v.object({
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
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/inbox/{id}',
  summary: 'Get an inbox document owned by the current user',
  tags: ['inbox'],
  output: v.object({ item: detailSchema }),
  handler: async (_input, { request, params }) => {
    const auth = await requireApiAuth(request)
    const id = params.id
    if (!id) {
      throw new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 })
    }
    const item = await getInboxDocument(auth.id, id)
    if (!item) {
      throw new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }
    return { item }
  },
})
