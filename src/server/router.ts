export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

type HandlerResult = Response | string | object | null

// one under-types its public `Endpoint` as `(req) => ...`, but at runtime it (and
// our `defineRoute`) invoke handlers with a second `{ params }` arg — dynamic routes
// like `[id]` read `params.id` from it. model that real shape here so the standalone
// router can pass params without fighting the narrower published type.
export type ApiHandler = (
  request: Request,
  ctx?: { params: Record<string, string> },
) => HandlerResult | Promise<HandlerResult>

export type ApiRoute = {
  method: HttpMethod
  pattern: string
  handler: ApiHandler
}

type Compiled = ApiRoute & { segments: string[]; catchAll: boolean }

function segmentSpecificity(seg: string): number {
  if (seg === '*') return 0
  if (seg.startsWith(':')) return 1
  return 2
}

function compareRoutes(a: Compiled, b: Compiled): number {
  const len = Math.min(a.segments.length, b.segments.length)
  for (let i = 0; i < len; i++) {
    const diff = segmentSpecificity(b.segments[i]!) - segmentSpecificity(a.segments[i]!)
    if (diff !== 0) return diff
  }
  if (a.catchAll !== b.catchAll) return a.catchAll ? 1 : -1
  return b.segments.length - a.segments.length
}

function compile(routes: ApiRoute[]): Compiled[] {
  return routes
    .map((r) => {
      const segments = r.pattern.split('/').filter(Boolean)
      const catchAll = segments.at(-1) === '*'
      return { ...r, segments, catchAll }
    })
    .sort(compareRoutes)
}

export function matchRoute(
  routes: ApiRoute[],
  method: string,
  pathname: string,
): { route: ApiRoute; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter(Boolean)
  for (const r of compile(routes)) {
    if (r.method !== method) continue
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < r.segments.length; i++) {
      const seg = r.segments[i]
      if (seg === '*') {
        break // catch-all matches the rest
      }
      const part = parts[i]
      if (part === undefined) {
        ok = false
        break
      }
      if (seg.startsWith(':')) {
        params[seg.slice(1)] = decodeURIComponent(part)
      } else if (seg !== part) {
        ok = false
        break
      }
    }
    if (ok && (r.catchAll || parts.length === r.segments.length)) {
      return { route: r, params }
    }
  }
  return null
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-app-version',
    vary: 'Origin',
  }
}

export function createApiFetch(routes: ApiRoute[], opts: { corsOrigins: string[] }) {
  const pathMethods = (pathname: string) =>
    routes.filter((r) => matchRoute([{ ...r }], r.method, pathname))

  return async function apiFetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    const cors = corsHeaders(origin, opts.corsOrigins)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const match = matchRoute(routes, request.method, url.pathname)
    if (!match) {
      // distinguish 405 (path exists, wrong method) from 404
      const anyMethod = pathMethods(url.pathname).length > 0
      return Response.json(
        { error: anyMethod ? 'method not allowed' : 'not found' },
        { status: anyMethod ? 405 : 404, headers: cors },
      )
    }

    try {
      const raw = await match.route.handler(request, { params: match.params })
      // one handlers may return a bare object/string/null; serialize like one does
      const res = raw instanceof Response ? raw : Response.json(raw)
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
      return res
    } catch (error) {
      if (error instanceof Response) {
        for (const [k, v] of Object.entries(cors)) error.headers.set(k, v)
        return error
      }
      const message = error instanceof Error ? error.message : 'internal server error'
      console.error(`[api] ${request.method} ${url.pathname}`, error)
      return Response.json({ error: message }, { status: 500, headers: cors })
    }
  }
}
