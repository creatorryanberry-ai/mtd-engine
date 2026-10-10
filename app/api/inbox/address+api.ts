import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { getOrCreateInboundEmailAddress } from '~/features/inbox/server/inboundEmailAddressService'

import type { Endpoint } from 'one'

const addressSchema = v.object({
  id: v.string(),
  emailAddress: v.string(),
  isActive: v.boolean(),
  createdAt: v.string(),
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/inbox/address',
  summary: 'Get or create the current user’s inbound email address',
  tags: ['inbox'],
  output: v.object({ address: addressSchema }),
  handler: async (_input, { request }) => {
    const auth = await requireApiAuth(request)
    const address = await getOrCreateInboundEmailAddress(auth.id)
    return { address }
  },
})
