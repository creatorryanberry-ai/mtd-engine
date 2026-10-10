import { toJsonSchema } from '@valibot/to-json-schema'

import type { RouteSpec } from '~/api/registry'
import type { BaseIssue, BaseSchema } from 'valibot'

type JsonSchema = ReturnType<typeof toJsonSchema>

export type BuildOpenapiSpecOptions = {
  contractVersion: number
  infoDescription: string
  servers: Array<{ url: string; description: string }>
  tags: Array<{ name: string; description: string }>
}

function pathParamNames(path: string) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!)
}

function queryParameters(input: BaseSchema<unknown, unknown, BaseIssue<unknown>>) {
  const schema = toJsonSchema(input) as JsonSchema & {
    properties?: Record<string, unknown>
    required?: string[]
  }

  if (!schema.properties) return []

  return Object.entries(schema.properties).map(([name, propSchema]) => ({
    name,
    in: 'query' as const,
    required: schema.required?.includes(name) ?? false,
    schema: propSchema,
  }))
}

function operationSecurity(route: RouteSpec) {
  if (route.security === 'public') return []
  return [{ bearerAuth: [] }, { cookieAuth: [] }]
}

function buildRequestBody(route: RouteSpec) {
  if (
    route.inputLocation === 'query' ||
    ((route.method === 'GET' || route.method === 'DELETE') &&
      route.inputLocation !== 'body')
  ) {
    return undefined
  }

  const contentType = route.requestContentType ?? 'application/json'

  if (!route.input && contentType !== 'multipart/form-data') return undefined

  const schema =
    contentType === 'multipart/form-data' && !route.input
      ? {
          type: 'object',
          properties: { file: { type: 'string', format: 'binary' } },
        }
      : route.input
        ? toJsonSchema(route.input as Parameters<typeof toJsonSchema>[0])
        : undefined

  if (!schema) return undefined

  const content: Record<string, unknown> = { schema }
  if (route.examples?.request !== undefined) {
    content.example = route.examples.request
  }

  return {
    required: true,
    content: { [contentType]: content },
  }
}

function buildResponses(route: RouteSpec) {
  const successStatus = route.successStatus ?? 200
  const successContentType = route.successContentType ?? 'application/json'
  const responses: Record<string, unknown> = {
    [successStatus]: {
      description: successStatus === 302 ? 'Redirect' : 'Success',
      ...(successStatus === 302
        ? {}
        : {
            content: {
              [successContentType]: {
                ...(route.output
                  ? {
                      schema: toJsonSchema(
                        route.output as Parameters<typeof toJsonSchema>[0],
                      ),
                    }
                  : {}),
                ...(route.examples?.response !== undefined
                  ? { example: route.examples.response }
                  : {}),
              },
            },
          }),
    },
  }

  for (const error of route.errorResponses ?? []) {
    responses[String(error.status)] = {
      description: error.description,
      ...(error.schema
        ? {
            content: {
              'application/json': {
                schema: toJsonSchema(error.schema as Parameters<typeof toJsonSchema>[0]),
              },
            },
          }
        : {}),
    }
  }

  return responses
}

function buildOperation(route: RouteSpec) {
  const parameters = [
    ...pathParamNames(route.path).map((name) => ({
      name,
      in: 'path' as const,
      required: true,
      schema: { type: 'string' },
    })),
    ...(route.input &&
    (route.inputLocation === 'query' ||
      ((route.method === 'GET' || route.method === 'DELETE') &&
        route.inputLocation !== 'body'))
      ? queryParameters(route.input)
      : []),
  ]

  const requestBody = buildRequestBody(route)

  return {
    summary: route.summary,
    ...(route.description ? { description: route.description } : {}),
    tags: route.tags,
    security: operationSecurity(route),
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses: buildResponses(route),
  }
}

export function buildOpenapiSpec(
  routes: RouteSpec[],
  options: BuildOpenapiSpecOptions,
): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const route of routes) {
    paths[route.path] ??= {}
    paths[route.path]![route.method.toLowerCase()] = buildOperation(route)
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Straight Up Tax API',
      version: String(options.contractVersion),
      description: options.infoDescription,
    },
    servers: options.servers,
    tags: options.tags,
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
        },
      },
    },
  }
}
