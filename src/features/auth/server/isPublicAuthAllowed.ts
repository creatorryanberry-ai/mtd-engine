import { server } from '~/env'

/** Server-only — public sign-up/sign-in must be explicitly enabled. */
export function isPublicAuthAllowed() {
  return server.ALLOW_PUBLIC_AUTH === '1'
}
