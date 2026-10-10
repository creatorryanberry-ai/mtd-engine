import { join } from 'node:path'

import { server } from '~/env'
import { assertDemoAuthFlagsSafe } from '~/features/auth/server/assertDemoAuthFlagsSafe'
import { isRealProductionRuntime } from '~/features/auth/server/isRealProductionRuntime'
import { APP_SCHEME } from '~/features/auth/constants'
import { createApiFetch } from '~/server/router'
import { apiRouteManifest } from '~/server/routeManifest.generated'
import { serveApiDocs } from '~/server/serveApiDocs'
import { serveApiDocsLogin } from '~/server/serveApiDocsLogin'

assertDemoAuthFlagsSafe({
  isRealProduction: isRealProductionRuntime({
    nodeEnv: process.env.NODE_ENV,
    betterAuthUrl: server.BETTER_AUTH_URL,
    apiServerUrl: server.API_SERVER_URL,
  }),
  allowDemoAuth: server.ALLOW_DEMO_AUTH,
  viteDemoMode: server.VITE_DEMO_MODE,
})

function resolveCorsOrigins(): string[] {
  const origins = new Set<string>()
  const proto = process.env.VITE_PROTOCOL || 'https'
  const web = process.env.VITE_WEB_HOSTNAME
  if (web) origins.add(`${proto}://${web}`)
  // native custom scheme (e.g. straightuptax://) — used as Origin by some clients
  origins.add(`${APP_SCHEME}://`)
  // local dev
  origins.add('http://localhost:8081')
  origins.add('http://localhost:8082')
  return [...origins]
}

const port = Number(process.env.PORT ?? 8081)
const apiFetch = createApiFetch(apiRouteManifest, { corsOrigins: resolveCorsOrigins() })
const docsRoot = join(process.cwd(), 'dist/api-docs')

const fetch = async (request: Request): Promise<Response> => {
  if (server.ENABLE_API_DOCS === '1') {
    const login = serveApiDocsLogin(request)
    if (login) return login
    const docs = await serveApiDocs(request, docsRoot)
    if (docs) return docs
  }
  return apiFetch(request)
}

if (import.meta.main) {
  Bun.serve({ port, fetch })
  console.info(
    `[api] standalone api listening on :${port} (${apiRouteManifest.length} routes)`,
  )
}

export { fetch, port }
