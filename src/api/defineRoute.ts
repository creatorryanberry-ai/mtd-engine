import * as v from 'valibot'

import { registerRoute } from './registry'

import type { HttpMethod, RouteSecurity } from './registry'
import type { BaseIssue, BaseSchema } from 'valibot'
import type { Endpoint } from 'one'

type RouteContext = {
  request: Request
  params: Record<string, string>
  searchParams: URLSearchParams
}

export function defineRoute<I, O>(spec: {
  method: HttpMethod
  path: string
  summary: string
  description?: string
  tags?: string[]
  security?: RouteSecurity
  input?: BaseSchema<I, unknown, BaseIssue<unknown>>
  output: BaseSchema<O, unknown, BaseIssue<unknown>>
  requestContentType?: string
  examples?: { request?: unknown; response?: unknown }
  errorResponses?: Array<{
    status: number
    description: string
    schema?: BaseSchema<unknown, unknown, BaseIssue<unknown>>
  }>
  successContentType?: string
  handler: (input: I, ctx: RouteContext) => Promise<O>
}): Endpoint {
  registerRoute({
    method: spec.method,
    path: spec.path,
    summary: spec.summary,
    description: spec.description,
    tags: spec.tags,
    security: spec.security,
    input: spec.input as BaseSchema<unknown, unknown, BaseIssue<unknown>> | undefined,
    output: spec.output as BaseSchema<unknown, unknown, BaseIssue<unknown>>,
    requestContentType: spec.requestContentType,
    examples: spec.examples,
    errorResponses: spec.errorResponses,
    successContentType: spec.successContentType,
  })

  return async (request, { params = {} } = {}) => {
    try {
      const url = new URL(request.url)
      let input: I = undefined as I

      if (spec.input) {
        if (spec.method === 'GET' || spec.method === 'DELETE') {
          const obj: Record<string, string> = {}
          for (const [key, value] of url.searchParams.entries()) {
            obj[key] = value
          }
          input = v.parse(spec.input, obj) as I
        } else {
          const body = await request.json().catch(() => ({}))
          input = v.parse(spec.input, body) as I
        }
      }

      const result = await spec.handler(input, {
        request,
        params: params as Record<string, string>,
        searchParams: url.searchParams,
      })

      const parsed = v.parse(spec.output, result)
      return Response.json(parsed)
    } catch (error) {
      if (error instanceof Response) return error
      if (error instanceof v.ValiError) {
        return Response.json(
          { error: 'Validation failed', issues: error.issues },
          { status: 400 },
        )
      }
      console.error(`[api] ${spec.method} ${spec.path}`, error)
      const message = error instanceof Error ? error.message : 'Internal server error'
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
