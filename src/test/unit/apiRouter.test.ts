import { describe, expect, it } from 'vitest'

import { createApiFetch, matchRoute, type ApiRoute } from '~/server/router'

const ok = (body: string) =>
  (async () => new Response(body)) as unknown as ApiRoute['handler']

const routes: ApiRoute[] = [
  { method: 'GET', pattern: '/api/health', handler: ok('health') },
  { method: 'GET', pattern: '/api/notifications', handler: ok('list') },
  {
    method: 'GET',
    pattern: '/api/notifications/:id',
    handler: (async (_req: Request, ctx: { params?: Record<string, string> }) =>
      new Response(ctx.params?.id ?? '')) as unknown as ApiRoute['handler'],
  },
  { method: 'POST', pattern: '/api/auth/*', handler: ok('auth') },
]

describe('matchRoute', () => {
  it('matches a static route', () => {
    const m = matchRoute(routes, 'GET', '/api/health')
    expect(m?.route.pattern).toBe('/api/health')
    expect(m?.params).toEqual({})
  })

  it('prefers the static list route over the :id route', () => {
    const m = matchRoute(routes, 'GET', '/api/notifications')
    expect(m?.route.pattern).toBe('/api/notifications')
  })

  it('captures a path param', () => {
    const m = matchRoute(routes, 'GET', '/api/notifications/abc')
    expect(m?.route.pattern).toBe('/api/notifications/:id')
    expect(m?.params).toEqual({ id: 'abc' })
  })

  it('matches a catch-all', () => {
    const m = matchRoute(routes, 'POST', '/api/auth/sign-in/email-otp')
    expect(m?.route.pattern).toBe('/api/auth/*')
  })

  it('returns null for an unknown path', () => {
    expect(matchRoute(routes, 'GET', '/api/nope')).toBeNull()
  })

  it('prefers a static segment over a param at the same position', () => {
    const mixed: ApiRoute[] = [
      { method: 'GET', pattern: '/api/x/:id', handler: ok('param') },
      { method: 'GET', pattern: '/api/x/detail', handler: ok('static') },
    ]
    expect(matchRoute(mixed, 'GET', '/api/x/detail')?.route.pattern).toBe('/api/x/detail')
    expect(matchRoute(mixed, 'GET', '/api/x/123')?.route.pattern).toBe('/api/x/:id')
  })

  it('ranks /a/b/* above /a/:b/:c/:d by segment specificity', () => {
    const mixed: ApiRoute[] = [
      { method: 'GET', pattern: '/a/:b/:c/:d', handler: ok('params') },
      { method: 'GET', pattern: '/a/b/*', handler: ok('catch') },
    ]
    expect(matchRoute(mixed, 'GET', '/a/b/c/d')?.route.pattern).toBe('/a/b/*')
  })
})

describe('createApiFetch', () => {
  const fetchApi = createApiFetch(routes, {
    corsOrigins: ['https://app.straightup.tax'],
  })

  it('invokes the matched handler and passes params', async () => {
    const res = await fetchApi(
      new Request('https://api.straightup.tax/api/notifications/xyz'),
    )
    expect(await res.text()).toBe('xyz')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await fetchApi(new Request('https://api.straightup.tax/api/nope'))
    expect(res.status).toBe(404)
  })

  it('returns 405 when the path matches but the method does not', async () => {
    const res = await fetchApi(
      new Request('https://api.straightup.tax/api/health', { method: 'DELETE' }),
    )
    expect(res.status).toBe(405)
  })

  it('answers CORS preflight for an allowed origin', async () => {
    const res = await fetchApi(
      new Request('https://api.straightup.tax/api/notifications', {
        method: 'OPTIONS',
        headers: {
          origin: 'https://app.straightup.tax',
          'access-control-request-method': 'GET',
        },
      }),
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://app.straightup.tax',
    )
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('sets an error envelope when the handler throws', async () => {
    const boom: ApiRoute[] = [
      {
        method: 'GET',
        pattern: '/api/boom',
        handler: (async () => {
          throw new Error('kaboom')
        }) as unknown as ApiRoute['handler'],
      },
    ]
    const f = createApiFetch(boom, { corsOrigins: [] })
    const res = await f(new Request('https://api.straightup.tax/api/boom'))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'kaboom' })
  })

  it('returns a thrown Response instead of swallowing to 500', async () => {
    const guarded: ApiRoute[] = [
      {
        method: 'GET',
        pattern: '/api/guarded',
        handler: (async () => {
          throw new Response('nope', { status: 401 })
        }) as unknown as ApiRoute['handler'],
      },
    ]
    const f = createApiFetch(guarded, {
      corsOrigins: ['https://app.straightup.tax'],
    })
    const res = await f(
      new Request('https://api.straightup.tax/api/guarded', {
        headers: { origin: 'https://app.straightup.tax' },
      }),
    )
    expect(res.status).toBe(401)
    expect(await res.text()).toBe('nope')
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://app.straightup.tax',
    )
  })

  it('serializes a bare object return into a json response with CORS', async () => {
    const jsonRoutes: ApiRoute[] = [
      { method: 'GET', pattern: '/api/obj', handler: async () => ({ hello: 'world' }) },
    ]
    const f = createApiFetch(jsonRoutes, {
      corsOrigins: ['https://app.straightup.tax'],
    })
    const res = await f(
      new Request('https://api.straightup.tax/api/obj', {
        headers: { origin: 'https://app.straightup.tax' },
      }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ hello: 'world' })
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://app.straightup.tax',
    )
  })

  it('merges CORS onto a successful matched response from an allowlisted origin', async () => {
    const res = await fetchApi(
      new Request('https://api.straightup.tax/api/health', {
        headers: { origin: 'https://app.straightup.tax' },
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('health')
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://app.straightup.tax',
    )
  })

  it('omits access-control-allow-origin for a non-allowlisted origin', async () => {
    const getRes = await fetchApi(
      new Request('https://api.straightup.tax/api/health', {
        headers: { origin: 'https://evil.example' },
      }),
    )
    expect(getRes.status).toBe(200)
    expect(getRes.headers.get('access-control-allow-origin')).toBeNull()

    const optionsRes = await fetchApi(
      new Request('https://api.straightup.tax/api/health', {
        method: 'OPTIONS',
        headers: {
          origin: 'https://evil.example',
          'access-control-request-method': 'GET',
        },
      }),
    )
    expect(optionsRes.status).toBe(204)
    expect(optionsRes.headers.get('access-control-allow-origin')).toBeNull()
  })
})
