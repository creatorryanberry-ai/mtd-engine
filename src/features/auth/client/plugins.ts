import { emailOTPClient } from 'better-auth/client/plugins'

import { platformClient } from './platformClient'

import type { BetterAuthClientPlugin } from 'better-auth'

export const plugins = [
  emailOTPClient(),
  platformClient(),
] satisfies BetterAuthClientPlugin[]

export function resetAuthPlugins() {
  plugins[0] = emailOTPClient()
  plugins[1] = platformClient()
}
