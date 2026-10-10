import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { listResponseSchema, notificationSchema } from '~/contract'
import { listNotifications } from '~/features/api/server/notifications'

import type { Endpoint } from 'one'

const querySchema = v.object({
  pageSize: v.optional(v.pipe(v.string(), v.transform(Number))),
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/notifications',
  summary: 'List notifications for the current user',
  tags: ['notifications'],
  input: querySchema,
  output: listResponseSchema(notificationSchema),
  handler: async (input, { request }) => {
    const auth = await requireApiAuth(request)
    const pageSize = input.pageSize != null ? Number(input.pageSize) : 50
    const items = await listNotifications(auth.id, pageSize)
    return { items }
  },
})
