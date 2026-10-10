/**
 * vercel deployments: derive the public urls from the branch alias vercel
 * provides, and force a direct postgres connection. imported before ~/env so
 * createEnv sees the values. a no-op everywhere else.
 */
export function applyVercelEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!env.VERCEL) return
  const host = env.VERCEL_BRANCH_URL || env.VERCEL_URL
  if (host) {
    const origin = `https://${host}`
    env.BETTER_AUTH_URL ||= origin
    env.API_SERVER_URL ||= origin
    env.ONE_SERVER_URL ||= origin
    env.VITE_PROTOCOL ||= 'https'
    env.VITE_API_HOSTNAME ||= host
    env.VITE_WEB_HOSTNAME ||= host
  }
  // rls context is set per session (set_config(..., false)); a transaction
  // pooler such as neon's pgbouncer would drop or cross-wire it between requests
  if (env.DATABASE_URL_UNPOOLED) env.DATABASE_URL = env.DATABASE_URL_UNPOOLED
}

applyVercelEnv()
