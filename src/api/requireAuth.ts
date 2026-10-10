import { enterUserDbContext } from '@mtd/database'
import { getAuthDataFromRequest } from '@mtd/better-auth-utils/server'

import { authServer } from '~/features/auth/server/authServer'

import type { AuthData } from '~/features/auth/types'

export async function requireApiAuth(request: Request): Promise<AuthData> {
  const authData = await getAuthDataFromRequest(authServer, request)
  if (!authData?.id) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  enterUserDbContext(authData.id)
  return authData
}
