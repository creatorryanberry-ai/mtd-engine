// must stay first: sets urls and the direct db connection before ~/env loads
import './vercelEnv'

import { fetch as apiFetch } from './api-entry'

import type { IncomingMessage, ServerResponse } from 'node:http'

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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await writeResponse(await apiFetch(await toRequest(req)), res)
  } catch (error) {
    console.error('[vercel-api] unhandled', error)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
    }
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
}
