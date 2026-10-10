import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { ignoreInboxDocument } from '~/features/inbox/server/inboxDocumentService'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/inbox/{id}/ignore',
  summary: 'Ignore an inbox document',
  tags: ['inbox'],
  output: v.object({ ok: v.literal(true) }),
  handler: async (_input, { request, params }) => {
    const auth = await requireApiAuth(request)
    const id = params.id
    if (!id) {
      throw new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 })
    }
    return ignoreInboxDocument(auth.id, id)
  },
})
