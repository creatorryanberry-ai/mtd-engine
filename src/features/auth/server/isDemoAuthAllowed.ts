import { server } from '~/env'

import { isRealProductionRuntime } from './isRealProductionRuntime'

/** Server-only — demo auth must never be enabled on real production deploys. */
export function isDemoAuthAllowed() {
  if (server.ALLOW_DEMO_AUTH !== '1') return false
  if (
    isRealProductionRuntime({
      nodeEnv: process.env.NODE_ENV,
      betterAuthUrl: server.BETTER_AUTH_URL,
      apiServerUrl: server.API_SERVER_URL,
    })
  ) {
    return false
  }
  return true
}
