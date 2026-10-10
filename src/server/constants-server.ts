import { server } from '~/env'

/** comma-separated allowlist from ADMIN_EMAILS; empty means role=admin only */
export const ADMIN_WHITELIST = new Set(
  (server.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
)
