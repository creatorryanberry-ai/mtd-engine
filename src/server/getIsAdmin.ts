import { ensure } from '@mtd/helpers'

import { ADMIN_WHITELIST } from '~/server/constants-server'

import type { AuthData } from '~/features/auth/types'

export const getIsAdmin = (authData?: AuthData | null) =>
  authData &&
  (authData.role === 'admin' || ADMIN_WHITELIST.has((authData.email || '').toLowerCase()))

export function ensureAdmin(authData?: AuthData | null) {
  ensure(getIsAdmin(authData), `is admin`)
}
