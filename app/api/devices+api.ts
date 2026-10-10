import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { deviceSchema } from '~/contract'
import { upsertDevice } from '~/features/api/server/devices'
import { notifyUser } from '~/api/notify'

import type { Endpoint } from 'one'

const bodySchema = v.object({
  id: v.string(),
  name: v.optional(v.nullable(v.string())),
  platform: v.string(),
  platformVersion: v.optional(v.nullable(v.string())),
  appVersion: v.optional(v.nullable(v.string())),
  pushToken: v.optional(v.nullable(v.string())),
  pushEnabled: v.optional(v.boolean()),
})

export const PUT: Endpoint = defineRoute({
  method: 'PUT',
  path: '/api/devices',
  summary: 'Register or update a device',
  tags: ['devices'],
  input: bodySchema,
  output: v.object({ item: deviceSchema }),
  handler: async (input, { request }) => {
    const auth = await requireApiAuth(request)
    const now = new Date().toISOString()
    const item = await upsertDevice(auth.id, {
      id: input.id,
      userId: auth.id,
      name: input.name ?? null,
      platform: input.platform,
      platformVersion: input.platformVersion ?? null,
      appVersion: input.appVersion ?? null,
      pushToken: input.pushToken ?? null,
      pushEnabled: input.pushEnabled ?? false,
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
    })
    await notifyUser(auth.id, { entity: 'device', id: item.id })
    return { item }
  },
})
