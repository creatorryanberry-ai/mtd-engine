import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { regenerateInboundEmailAddress } from '~/features/inbox/server/inboundEmailAddressService'

import type { Endpoint } from 'one'

export const POST: Endpoint = defineRoute({
  method: 'POST',
  path: '/api/inbox/address/regenerate',
  summary: 'Revoke the current inbound address and issue a new one',
  tags: ['inbox'],
  output: v.object({
    address: v.object({
      id: v.string(),
      emailAddress: v.string(),
      isActive: v.boolean(),
      createdAt: v.string(),
    }),
  }),
  handler: async (_input, { request }) => {
    const auth = await requireApiAuth(request)
    const address = await regenerateInboundEmailAddress(auth.id)
    return { address }
  },
})
