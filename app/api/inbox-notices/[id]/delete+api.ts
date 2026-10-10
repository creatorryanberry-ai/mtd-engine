import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { deleteInboxNotice } from '~/features/inbox/server/inboxDocumentService'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/inbox-notices/{id}/delete',
  summary: 'Delete a no-attachment inbox email notice',
  tags: ['inbox'],
  output: v.object({ ok: v.literal(true) }),
  handler: async (_input, { request, params }) => {
    const auth = await requireApiAuth(request)
    const id = params.id
    if (!id) {
      throw new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 })
    }
    return deleteInboxNotice(auth.id, id)
  },
})
