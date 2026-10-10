import * as v from 'valibot'
import { toJsonSchema } from '@valibot/to-json-schema'
import { describe, expect, it } from 'vitest'

import { buildOpenapiSpec } from '~/api/openapi/buildSpec'
import '~/api/openapi/load'
import { apiRoutes } from '~/api/registry'

import type { RouteSpec } from '~/api/registry'

const baseOpts = {
  contractVersion: 1,
  infoDescription: 'Test API',
  servers: [{ url: 'http://localhost:8082', description: 'Local' }],
  tags: [{ name: 'meta', description: 'Meta' }],
}

describe('buildOpenapiSpec', () => {
  it('emits servers, securitySchemes, and public vs authed security', () => {
    const routes: RouteSpec[] = [
      {
        method: 'GET',
        path: '/api/health',
        summary: 'Health',
        tags: ['meta'],
        security: 'public',
        output: v.object({ status: v.string() }),
      },
      {
        method: 'GET',
        path: '/api/users/me',
        summary: 'Me',
        description: 'Current user',
        tags: ['users'],
        security: 'bearer',
        output: v.object({ id: v.string() }),
        examples: { response: { id: 'u1' } },
        errorResponses: [
          {
            status: 401,
            description: 'Unauthorized',
            schema: v.object({ error: v.string() }),
          },
        ],
      },
    ]

    const spec = buildOpenapiSpec(routes, baseOpts) as any
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('Straight Up Tax API')
    expect(spec.info.description).toBe('Test API')
    expect(spec.servers).toEqual(baseOpts.servers)
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    })
    expect(spec.components.securitySchemes.cookieAuth).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'better-auth.session_token',
    })
    expect(spec.paths['/api/health'].get.security).toEqual([])
    expect(spec.info.version).toBe(String(baseOpts.contractVersion))
    expect(spec.paths['/api/users/me'].get.security).toEqual([
      { bearerAuth: [] },
      { cookieAuth: [] },
    ])
    expect(spec.paths['/api/users/me'].get.description).toBe('Current user')
    expect(spec.paths['/api/users/me'].get.responses['401']).toBeTruthy()
    expect(
      spec.paths['/api/users/me'].get.responses['200'].content['application/json']
        .example,
    ).toEqual({ id: 'u1' })
  })

  it('supports multipart request and sse success content types', () => {
    const routes: RouteSpec[] = [
      {
        method: 'POST',
        path: '/api/file/upload',
        summary: 'Upload',
        security: 'bearer',
        requestContentType: 'multipart/form-data',
        output: v.object({ url: v.string() }),
      },
      {
        method: 'GET',
        path: '/api/events',
        summary: 'Events',
        security: 'bearer',
        successContentType: 'text/event-stream',
        output: v.object({ type: v.string() }),
      },
    ]
    const spec = buildOpenapiSpec(routes, baseOpts) as any
    expect(
      spec.paths['/api/file/upload'].post.requestBody.content['multipart/form-data'],
    ).toBeTruthy()
    expect(
      spec.paths['/api/events'].get.responses['200'].content['text/event-stream'],
    ).toBeTruthy()
  })

  it('documents empty redirect success responses', () => {
    const routes: RouteSpec[] = [
      {
        method: 'GET',
        path: '/api/hmrc/callback',
        summary: 'Handle HMRC authorization callback',
        security: 'public',
        input: v.object({
          code: v.string(),
          state: v.string(),
          error: v.optional(v.string()),
        }),
        successStatus: 302,
      },
    ]

    const spec = buildOpenapiSpec(routes, baseOpts) as any
    const responses = spec.paths['/api/hmrc/callback'].get.responses

    expect(responses['302']).toEqual({ description: 'Redirect' })
    expect(responses['200']).toBeUndefined()
  })

  it('honors requestContentType override for non-multipart bodies', () => {
    const routes: RouteSpec[] = [
      {
        method: 'POST',
        path: '/api/webhook',
        summary: 'Webhook',
        security: 'public',
        requestContentType: 'application/x-www-form-urlencoded',
        input: v.object({ token: v.string() }),
      },
    ]
    const spec = buildOpenapiSpec(routes, baseOpts) as any
    const body = spec.paths['/api/webhook'].post.requestBody
    expect(body.content['application/x-www-form-urlencoded']).toBeTruthy()
    expect(body.content['application/json']).toBeUndefined()
  })

  it('supports JSON request bodies for DELETE operations', () => {
    const routes: RouteSpec[] = [
      {
        method: 'DELETE',
        path: '/api/transactions/manual',
        summary: 'Delete manual transaction',
        security: 'bearer',
        inputLocation: 'body',
        input: v.object({ id: v.string() }),
      },
    ]
    const spec = buildOpenapiSpec(routes, baseOpts) as any
    const operation = spec.paths['/api/transactions/manual'].delete

    expect(operation.requestBody.content['application/json'].schema.required).toContain(
      'id',
    )
    expect(operation.parameters).toBeUndefined()
  })

  it('documents quarterId as required for quarterly submissions', () => {
    const route = apiRoutes.find(
      ({ method, path }) =>
        method === 'POST' && path === '/api/submissions/quarterly/jobs',
    )
    if (!route?.input) throw new Error('quarterly submission route input is missing')

    const schema = toJsonSchema(route.input) as { required?: string[] }
    expect(schema.required).toContain('quarterId')
  })

  it('documents bank account and legacy transaction operations', () => {
    const operations = [
      ['GET', '/api/bank-accounts'],
      ['PATCH', '/api/bank-accounts/{id}'],
      ['DELETE', '/api/bank-accounts/{id}'],
      ['GET', '/api/bank-accounts/status'],
      ['GET', '/api/transactions/search'],
      ['PATCH', '/api/transactions'],
      ['POST', '/api/transactions/approve'],
      ['POST', '/api/transactions/manual'],
      ['PATCH', '/api/transactions/manual'],
      ['DELETE', '/api/transactions/manual'],
    ] as const

    for (const [method, path] of operations) {
      const route = apiRoutes.find(
        (candidate) => candidate.method === method && candidate.path === path,
      )
      expect(route, `${method} ${path}`).toBeDefined()
      expect(route?.description).toBeTruthy()
      expect(route?.errorResponses).toContainEqual(
        expect.objectContaining({ status: 401 }),
      )
    }
  })

  it('documents file uploads and public analytics actions', () => {
    const receiptUpload = apiRoutes.find(
      ({ method, path }) => method === 'POST' && path === '/api/file/receipt',
    )
    const genericUpload = apiRoutes.find(
      ({ method, path }) => method === 'POST' && path === '/api/file/upload',
    )
    const stats = apiRoutes.find(
      ({ method, path }) => method === 'POST' && path === '/api/stats',
    )

    expect(receiptUpload?.requestContentType).toBe('multipart/form-data')
    expect(genericUpload?.requestContentType).toBe('multipart/form-data')
    expect(stats?.security).toBe('public')
    if (!stats?.input) throw new Error('POST /api/stats route input is missing')
    expect(
      v.safeParse(stats.input, { action: 'capture', event: 'feature_used' }).success,
    ).toBe(true)
    expect(
      v.safeParse(stats.input, { action: 'identify', distinct_id: 'user_01' }).success,
    ).toBe(true)
    expect(
      v.safeParse(stats.input, { action: 'decide', distinct_id: 'user_01' }).success,
    ).toBe(true)
    expect(v.safeParse(stats.input, { action: 'capture' }).success).toBe(false)
    expect(v.safeParse(stats.input, { action: 'identify' }).success).toBe(false)
    expect(v.safeParse(stats.input, { action: 'decide' }).success).toBe(false)
  })

  it('matches legacy transaction documentation to handler validation', () => {
    const findRoute = (method: string, path: string) => {
      const route = apiRoutes.find(
        (candidate) => candidate.method === method && candidate.path === path,
      )
      if (!route?.input) throw new Error(`${method} ${path} route input is missing`)
      return route
    }

    const update = findRoute('PATCH', '/api/transactions')
    expect(update.examples?.request).toMatchObject({ hmrcCategory: 'office_costs' })

    const approve = findRoute('POST', '/api/transactions/approve')
    expect(v.safeParse(approve.input!, {}).success).toBe(false)
    expect(v.safeParse(approve.input!, { ids: [] }).success).toBe(false)
    expect(v.safeParse(approve.input!, { id: 'txn_01' }).success).toBe(true)
    expect(v.safeParse(approve.input!, { ids: ['txn_01'] }).success).toBe(true)

    const bankTransactions = findRoute('GET', '/api/transactions/search')
    const querySchema = toJsonSchema(bankTransactions.input!) as {
      properties?: Record<string, { type?: string }>
    }
    expect(querySchema.properties?.limit?.type).toBe('number')
    expect(querySchema.properties?.offset?.type).toBe('number')
    expect(querySchema.properties?.excludeReviewed?.type).toBe('boolean')
    expect(querySchema.properties?.reviewedOnly?.type).toBe('boolean')

    const manualCreate = findRoute('POST', '/api/transactions/manual')
    const manualSchema = toJsonSchema(manualCreate.input!) as {
      properties?: Record<
        string,
        {
          format?: string
          minLength?: number
          not?: { const?: number }
          pattern?: string
        }
      >
    }
    expect(manualSchema.properties?.name).toMatchObject({
      minLength: 1,
      pattern: '\\S',
    })
    expect(manualSchema.properties?.amount?.not).toEqual({ const: 0 })
    expect(manualSchema.properties?.date?.format).toBeUndefined()
  })

  it('allows lifecycle and entity-change SSE payloads', () => {
    const route = apiRoutes.find(
      ({ method, path }) => method === 'GET' && path === '/api/events',
    )
    if (!route?.output) throw new Error('events route output is missing')

    expect(v.safeParse(route.output, { type: 'connected' }).success).toBe(true)
    expect(v.safeParse(route.output, { type: 'heartbeat', at: 1 }).success).toBe(true)
    expect(
      v.safeParse(route.output, { type: 'error', message: 'subscribe_failed' }).success,
    ).toBe(true)
    expect(
      v.safeParse(route.output, {
        entity: 'submission',
        id: 'job_01',
        status: 'pending',
      }).success,
    ).toBe(true)

    const schema = toJsonSchema(route.output) as {
      anyOf?: Array<{ required?: string[] }>
    }
    expect(schema.anyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ required: expect.arrayContaining(['entity']) }),
      ]),
    )
    expect(schema.anyOf?.every((branch) => branch.required?.includes('type'))).toBe(false)
  })
})
