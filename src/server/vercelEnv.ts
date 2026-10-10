/**
 * vercel deployments: derive the public urls from the url vercel assigns, and
 * force a direct postgres connection. call before ~/env loads so createEnv sees
 * the values (the package is sideEffects: false, so a bare import is dropped).
 * a no-op everywhere else.
 */
export function applyVercelEnv(env: NodeJS.ProcessEnv = process.env) {
  if (!env.VERCEL) return
  // production deploys are served from the stable project url, previews from the branch alias
  const host =
    env.VERCEL_ENV === 'production'
      ? env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL
      : env.VERCEL_BRANCH_URL || env.VERCEL_URL
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
  // previews sign in with the demo code; without a postmark token use the
  // placeholder isEmailConfigured() already treats as "email not configured"
  env.POSTMARK_SERVER_TOKEN ||= 'your-postmark-server-token'
}
