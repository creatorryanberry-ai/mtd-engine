import type { BaseIssue, BaseSchema } from 'valibot'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type RouteSecurity = 'bearer' | 'cookie' | 'public'

export type RouteSpec = {
  method: HttpMethod
  path: string
  summary: string
  description?: string
  tags?: string[]
  /** default: authenticated via bearer OR cookie. use 'public' for open routes */
  security?: RouteSecurity
  input?: BaseSchema<unknown, unknown, BaseIssue<unknown>>
  /** default: query for GET/DELETE, JSON body for other methods */
  inputLocation?: 'body' | 'query'
  output?: BaseSchema<unknown, unknown, BaseIssue<unknown>>
  /** when set, used instead of JSON input schema (e.g. multipart) */
  requestContentType?: string
  examples?: { request?: unknown; response?: unknown }
  errorResponses?: Array<{
    status: number
    description: string
    schema?: BaseSchema<unknown, unknown, BaseIssue<unknown>>
  }>
  /** override success response content-type (default application/json). use for SSE */
  successContentType?: string
  /** override success response status (default 200). use for redirects */
  successStatus?: number
}

export const apiRoutes: RouteSpec[] = []

export function registerRoute(spec: RouteSpec) {
  apiRoutes.push(spec)
}
