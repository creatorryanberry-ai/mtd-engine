import * as v from 'valibot'

import { registerRoute } from '~/api/registry'
import { errorResponseSchema } from '~/contract'
import {
  connectInputSchema,
  connectorCatalogSchema,
  connectResponseSchema,
  createWorkspaceInputSchema,
  dashboardSummarySchema,
  engineAuditLogSchema,
  engineBrandKitSchema,
  engineBrandSchema,
  engineConnectionListSchema,
  engineContactSchema,
  engineEventSchema,
  engineLlmCallSummarySchema,
  engineMembershipSchema,
  engineOrderSchema,
  engineWorkspaceListItemSchema,
  engineWorkspaceSchema,
  importBrandKitInputSchema,
  importBrandKitResponseSchema,
  ingestEventsInputSchema,
  ingestEventsResponseSchema,
  inviteMemberInputSchema,
  okSchema,
  pageSchema,
  paginatedQuerySchema,
  syncInputSchema,
  syncResponseSchema,
  updateMemberInputSchema,
  updateWorkspaceInputSchema,
  upsertBrandInputSchema,
  upsertBrandKitInputSchema,
} from '~/features/engine/contract'

import type { RouteSpec } from '~/api/registry'

/**
 * static OpenAPI registry for the growth engine. the route modules under
 * app/api/engine use defineRoute with the same schemas, but cannot be imported
 * by the docs build (server-only), so every operation is mirrored here. keep
 * this file in step with docs/engine-phase-1.md.
 */

export const unauthorized = {
  status: 401,
  description: 'Unauthorized',
  schema: errorResponseSchema,
}
export const forbidden = {
  status: 403,
  description: 'Insufficient role',
  schema: errorResponseSchema,
}
export const notFound = {
  status: 404,
  description: 'Not found',
  schema: errorResponseSchema,
}

const WS = '/api/engine/workspaces/{workspaceId}'

export function engineRoute(spec: Omit<RouteSpec, 'tags'> & { role?: string }) {
  const { role, ...rest } = spec
  const roleNote = role ? `Requires the ${role} role or above.` : null
  registerRoute({
    ...rest,
    tags: ['engine'],
    description: [rest.description, roleNote].filter(Boolean).join(' ') || undefined,
    errorResponses:
      rest.errorResponses ??
      (spec.security === 'public' ? [] : [unauthorized, forbidden, notFound]),
  })
}

engineRoute({
  method: 'GET',
  path: '/api/engine/workspaces',
  summary: 'List engine workspaces the current user belongs to',
  output: v.object({ items: v.array(engineWorkspaceListItemSchema) }),
  errorResponses: [unauthorized],
})

engineRoute({
  method: 'POST',
  path: '/api/engine/workspaces',
  summary: 'Create an engine workspace owned by the current user',
  description:
    'Bootstraps the owner membership, default channels with autonomy level 0, a spend cap guardrail and a default brand.',
  input: createWorkspaceInputSchema,
  output: engineWorkspaceListItemSchema,
  errorResponses: [unauthorized],
})

engineRoute({
  method: 'GET',
  path: WS,
  summary: 'Get an engine workspace',
  role: 'viewer',
  output: engineWorkspaceSchema,
})

engineRoute({
  method: 'PATCH',
  path: WS,
  summary: 'Update workspace settings, budgets and the kill switch',
  role: 'admin',
  input: updateWorkspaceInputSchema,
  output: engineWorkspaceSchema,
})

engineRoute({
  method: 'GET',
  path: `${WS}/members`,
  summary: 'List workspace members',
  role: 'viewer',
  output: v.object({ items: v.array(engineMembershipSchema) }),
})

engineRoute({
  method: 'POST',
  path: `${WS}/members`,
  summary: 'Add an existing user to the workspace by email',
  role: 'admin',
  input: inviteMemberInputSchema,
  output: engineMembershipSchema,
})

engineRoute({
  method: 'PATCH',
  path: `${WS}/members/{memberId}`,
  summary: 'Change a member role',
  role: 'admin',
  input: updateMemberInputSchema,
  output: engineMembershipSchema,
})

engineRoute({
  method: 'DELETE',
  path: `${WS}/members/{memberId}`,
  summary: 'Remove a member from the workspace',
  role: 'admin',
  output: okSchema,
})

engineRoute({
  method: 'GET',
  path: `${WS}/brands`,
  summary: 'List brands in the workspace',
  role: 'viewer',
  output: v.object({ items: v.array(engineBrandSchema) }),
})

engineRoute({
  method: 'POST',
  path: `${WS}/brands`,
  summary: 'Create a brand',
  role: 'marketer',
  input: upsertBrandInputSchema,
  output: engineBrandSchema,
})

engineRoute({
  method: 'PATCH',
  path: `${WS}/brands/{brandId}`,
  summary: 'Update a brand',
  role: 'marketer',
  input: v.partial(upsertBrandInputSchema),
  output: engineBrandSchema,
})

engineRoute({
  method: 'GET',
  path: `${WS}/brands/{brandId}/kit`,
  summary: 'Get the current brand kit version',
  role: 'viewer',
  output: engineBrandKitSchema,
})

engineRoute({
  method: 'PUT',
  path: `${WS}/brands/{brandId}/kit`,
  summary: 'Save a new brand kit version',
  description: 'Every save is a new immutable version; omitted fields carry over.',
  role: 'marketer',
  input: upsertBrandKitInputSchema,
  output: engineBrandKitSchema,
})

engineRoute({
  method: 'POST',
  path: `${WS}/brands/{brandId}/kit/import`,
  summary: 'Draft a brand kit from a website',
  description:
    'Fetches the website server-side and asks the fast model to draft colours, fonts, tone, claims and personas. Nothing is saved; review the draft then PUT the kit.',
  role: 'marketer',
  input: importBrandKitInputSchema,
  output: importBrandKitResponseSchema,
  errorResponses: [
    unauthorized,
    forbidden,
    notFound,
    { status: 400, description: 'Url not allowed', schema: errorResponseSchema },
    { status: 402, description: 'Monthly LLM budget spent', schema: errorResponseSchema },
    {
      status: 422,
      description: 'Website could not be read',
      schema: errorResponseSchema,
    },
    { status: 503, description: 'LLM not configured', schema: errorResponseSchema },
  ],
})

engineRoute({
  method: 'GET',
  path: `${WS}/audit`,
  summary: 'Audit log, newest first',
  role: 'viewer',
  input: paginatedQuerySchema,
  output: pageSchema(engineAuditLogSchema),
})

engineRoute({
  method: 'POST',
  path: `${WS}/events`,
  summary: 'Ingest a batch of events',
  description:
    'Touches (impression, click, open, reply, visit, form, call, meeting, purchase, refund). An email resolves the contact; sourceEventId makes rows idempotent.',
  role: 'marketer',
  input: ingestEventsInputSchema,
  output: ingestEventsResponseSchema,
})

engineRoute({
  method: 'GET',
  path: `${WS}/events`,
  summary: 'Recent events, newest first',
  role: 'viewer',
  input: paginatedQuerySchema,
  output: pageSchema(engineEventSchema),
})

engineRoute({
  method: 'GET',
  path: `${WS}/contacts`,
  summary: 'Contacts, newest first',
  role: 'viewer',
  input: paginatedQuerySchema,
  output: pageSchema(engineContactSchema),
})

engineRoute({
  method: 'GET',
  path: `${WS}/orders`,
  summary: 'Orders, newest first',
  role: 'viewer',
  input: paginatedQuerySchema,
  output: pageSchema(engineOrderSchema),
})

engineRoute({
  method: 'GET',
  path: `${WS}/dashboard`,
  summary: 'Command centre summary for the workspace',
  description:
    'Gross profit, revenue, orders, contacts, pipeline, approvals, LLM spend and alerts.',
  role: 'viewer',
  output: dashboardSummarySchema,
})

engineRoute({
  method: 'GET',
  path: `${WS}/llm/calls`,
  summary: 'List recent LLM calls with cost',
  description:
    'Every call through the gateway, newest first, with tokens, cost and latency. Prompts and outputs are not included.',
  role: 'admin',
  input: paginatedQuerySchema,
  output: pageSchema(engineLlmCallSummarySchema),
})

engineRoute({
  method: 'GET',
  path: '/api/engine/connectors',
  summary: 'Connector catalog',
  description:
    'Every connector the engine can use, with whether the server has the provider credentials to connect it.',
  output: connectorCatalogSchema,
  errorResponses: [unauthorized],
})

engineRoute({
  method: 'GET',
  path: `${WS}/connections`,
  summary: 'List workspace connections',
  description: 'Credentials are never included.',
  role: 'viewer',
  output: engineConnectionListSchema,
})

engineRoute({
  method: 'POST',
  path: `${WS}/connections/connect/{provider}`,
  summary: 'Start a connection',
  description:
    'OAuth providers return an authorizeUrl to redirect the user to; api-key providers take the key in the body, verify it and return the connection id.',
  role: 'admin',
  input: connectInputSchema,
  output: connectResponseSchema,
})

engineRoute({
  method: 'POST',
  path: `${WS}/connections/{connectionId}/sync`,
  summary: 'Enqueue a connection sync',
  description:
    'Queues a background sync for the connection. Scope defaults to orders for revenue connectors and all for channels.',
  role: 'marketer',
  input: syncInputSchema,
  output: syncResponseSchema,
})

engineRoute({
  method: 'DELETE',
  path: `${WS}/connections/{connectionId}`,
  summary: 'Disconnect a connection',
  description: 'Marks the connection disconnected and wipes its stored credentials.',
  role: 'admin',
  output: okSchema,
})

engineRoute({
  method: 'GET',
  path: '/api/engine/connections/hubspot/callback',
  summary: 'HubSpot OAuth callback',
  description:
    'Completes a HubSpot authorisation started from POST /api/engine/workspaces/{workspaceId}/connections/connect/hubspot and redirects back to the integrations screen.',
  security: 'public',
  input: v.object({
    code: v.optional(v.string()),
    state: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  output: v.object({}),
  successStatus: 302,
  errorResponses: [
    { status: 400, description: 'Invalid state', schema: errorResponseSchema },
  ],
})

engineRoute({
  method: 'POST',
  path: '/api/engine/webhooks/stripe/{connectionId}',
  summary: 'Stripe webhook',
  description:
    'Receives signed Stripe events (charges, refunds) for one connection. The signature is verified with the connection webhook secret before anything is stored.',
  security: 'public',
  requestContentType: 'application/json',
  output: v.object({ received: v.boolean() }),
  errorResponses: [
    { status: 400, description: 'Bad signature', schema: errorResponseSchema },
    { status: 404, description: 'Unknown connection', schema: errorResponseSchema },
  ],
})
