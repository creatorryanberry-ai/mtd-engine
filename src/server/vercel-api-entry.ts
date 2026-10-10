import { handleVercelDemoSeed, VERCEL_SEED_PATH } from './vercelDemoSeed'
import { applyVercelEnv } from './vercelEnv'

import type { IncomingMessage, ServerResponse } from 'node:http'

// urls and the direct db connection must be set before ~/env loads
applyVercelEnv()
const { fetch: apiFetch } = await import('./api-entry')

/**
 * single vercel node function serving every /api route through the same
 * router and manifest as the standalone api service (dist/api.js).
 */

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function toRequest(req: IncomingMessage) {
  const forwardedProto = req.headers['x-forwarded-proto']
  const proto =
    (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost'
  const url = new URL(
    req.url ?? '/',
    `${proto}://${Array.isArray(host) ? host[0] : host}`,
  )

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) for (const item of value) headers.append(key, item)
    else headers.set(key, value)
  }

  // the vercel routing table forwards the original path; restore it for the router
  const forwardedPath = url.searchParams.get('__vercel_path')
  if (forwardedPath !== null) {
    url.searchParams.delete('__vercel_path')
    url.pathname = forwardedPath || '/api'
  }

  const method = req.method ?? 'GET'
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
  return new Request(url, { method, headers, body })
}

async function writeResponse(response: Response, res: ServerResponse) {
  res.statusCode = response.status
  const cookies = response.headers.getSetCookie()
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') res.setHeader(key, value)
  })
  if (cookies.length > 0) res.setHeader('set-cookie', cookies)

  if (!response.body) {
    res.end()
    return
  }
  const reader = response.body.getReader()
  // close the upstream stream (e.g. server-sent events) when the client goes away
  res.on('close', () => void reader.cancel().catch(() => {}))
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(value)
  }
  res.end()
}

/**
 * a project serves several *.vercel.app aliases, and vercel authentication does
 * not cover all of them. serve the api only on the host auth was built for.
 */
function isCanonicalHost(host: string) {
  const canonical = process.env.BETTER_AUTH_URL
  if (!canonical) return true
  try {
    return new URL(canonical).host === host
  } catch {
    return false
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const request = await toRequest(req)
    const url = new URL(request.url)
    if (!isCanonicalHost(url.host)) {
      res.statusCode = 404
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: 'not found' }))
      return
    }
    const response =
      url.pathname === VERCEL_SEED_PATH
        ? await handleVercelDemoSeed(url)
        : await apiFetch(request)
    await writeResponse(response, res)
  } catch (error) {
    console.error('[vercel-api] unhandled', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
    }
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
}
