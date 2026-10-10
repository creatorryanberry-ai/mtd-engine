import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { markInboxDocumentProcessed } from '~/features/inbox/server/inboxDocumentService'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/inbox/{id}/processed',
  summary: 'Mark an inbox document as processed after saving a transaction',
  tags: ['inbox'],
  input: v.object({
    mtdTransactionId: v.string(),
  }),
  output: v.object({ ok: v.literal(true) }),
  handler: async (input, { request, params }) => {
    const auth = await requireApiAuth(request)
    const id = params.id
    if (!id) {
      throw new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 })
    }
    return markInboxDocumentProcessed(auth.id, id, input.mtdTransactionId)
  },
})
