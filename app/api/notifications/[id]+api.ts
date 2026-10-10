import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { notificationSchema } from '~/contract'
import { updateNotification } from '~/features/api/server/notifications'
import { notifyUser } from '~/api/notify'

import type { Endpoint } from 'one'

const patchSchema = v.object({
  read: v.optional(v.boolean()),
})

export const PATCH: Endpoint = defineRoute({
  method: 'PATCH',
  path: '/api/notifications/{id}',
  summary: 'Update a notification',
  tags: ['notifications'],
  input: patchSchema,
  output: v.object({ item: v.nullable(notificationSchema) }),
  handler: async (input, { request, params }) => {
    const auth = await requireApiAuth(request)
    const id = params.id
    if (!id) throw new Error('Missing notification id')
    const item = await updateNotification(auth.id, id, input)
    await notifyUser(auth.id, { entity: 'notification', id })
    return { item }
  },
})
