import { eq } from 'drizzle-orm'
import * as v from 'valibot'

import { defineRoute } from '~/api/defineRoute'
import { requireApiAuth } from '~/api/requireAuth'
import { drizzle } from '~/database/db'
import { userPublic } from '~/database/schema'

import type { Endpoint } from 'one'

const querySchema = v.object({
  username: v.string(),
})

export const GET: Endpoint = defineRoute({
  method: 'GET',
  path: '/api/users/username-available',
  summary: 'Check whether a username is available',
  tags: ['users'],
  input: querySchema,
  output: v.object({ available: v.boolean() }),
  handler: async (input, { request }) => {
    const auth = await requireApiAuth(request)
    const rows = await drizzle
      .select()
      .from(userPublic)
      .where(eq(userPublic.username, input.username))
      .limit(1)
    const taken = rows[0] && rows[0].id !== auth.id
    return { available: !taken }
  },
})
