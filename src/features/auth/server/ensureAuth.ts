import { enterUserDbContext } from '@mtd/database'

import { ADMIN_WHITELIST } from '~/server/constants-server'
import { authServer } from './authServer'

export class NotAuthorizedError extends Error {}

export async function ensureAuth(req: Request, role?: 'admin') {
  const session = await authServer.api.getSession({
    headers: req.headers,
  })

  if (!session) {
    console.warn(`Unauthenticated request: ${req.url}`)
    throw Response.json(
      {
        error: `Not authorized`,
      },
      {
        status: 401,
      },
    )
  }

  enterUserDbContext(session.user.id)

  if (role === 'admin') {
    const isAdmin =
      session.user.role === 'admin' ||
      (session.user.email ? ADMIN_WHITELIST.has(session.user.email.toLowerCase()) : false)
    if (!isAdmin) {
      console.warn(
        `Forbidden: ${req.url}, required role: ${role}, user role: ${session.user.role}`,
      )
      throw Response.json(
        {
          error: `Forbidden`,
        },
        {
          status: 403,
        },
      )
    }
  }

  return session
}
