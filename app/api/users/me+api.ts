import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { userPublicSchema, userStateSchema } from '~/contract'
import {
  getUserPublicById,
  getUserWithState,
  validateUsername,
  updateUserPublic,
  updateUserState,
} from '~/features/api/server/users'
import { notifyUser } from '~/api/notify'

import type { Endpoint } from 'one'

const meOutputSchema = v.object({
  user: v.nullable(userPublicSchema),
  state: v.nullable(userStateSchema),
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/users/me',
  summary: 'Get the current user profile',
  tags: ['users'],
  output: meOutputSchema,
  handler: async (_input, { request }) => {
    const auth = await requireApiAuth(request)
    const result = await getUserWithState(auth.id)
    if (!result) return { user: null, state: null }
    return result
  },
})

const patchSchema = v.object({
  name: v.optional(v.string()),
  username: v.optional(v.string()),
  image: v.optional(v.nullable(v.string())),
  hasOnboarded: v.optional(v.boolean()),
})

export const PATCH: Endpoint = defineRoute({
  method: 'PATCH',
  path: '/api/users/me',
  summary: 'Update the current user profile',
  tags: ['users'],
  input: patchSchema,
  output: v.object({
    user: v.nullable(userPublicSchema),
    state: v.nullable(userStateSchema),
  }),
  handler: async (input, { request }) => {
    const auth = await requireApiAuth(request)
    const { hasOnboarded, ...publicPatch } = input

    if (publicPatch.username) {
      await validateUsername(publicPatch.username, auth.id)
    }

    const hasPublicPatch = Object.values(publicPatch).some((val) => val !== undefined)
    const user = hasPublicPatch
      ? await updateUserPublic(auth.id, publicPatch)
      : await getUserPublicById(auth.id)

    const state =
      hasOnboarded === undefined ? null : await updateUserState(auth.id, { hasOnboarded })

    await notifyUser(auth.id, { entity: hasPublicPatch ? 'userPublic' : 'userState' })
    return { user, state }
  },
})
