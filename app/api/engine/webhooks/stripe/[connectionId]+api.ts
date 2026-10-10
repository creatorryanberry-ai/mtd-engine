import { and, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineEvent } from '~/database/engineSchema'
import { stripeConnector } from '~/features/engine/channels/stripe/StripeConnector'
import {
  buildConnectorContext,
  getConnection,
} from '~/features/engine/channels/server/connectionService'
import { newId } from '~/features/engine/core/ids'
import { upsertOrderFromRevenue } from '~/features/engine/sense/server/orders'
import { jsonError } from '~/server/apiHelpers'

import type { Endpoint } from 'one'

const WEBHOOK_SOURCE = 'stripe_webhook'

function connectionIdFrom(request: Request, params?: Record<string, string>) {
  if (params?.connectionId) return params.connectionId
  const match = new URL(request.url).pathname.match(
    /\/api\/engine\/webhooks\/stripe\/([^/]+)$/,
  )
  return match?.[1] ?? null
}

/**
 * documented in src/api/openapi/engine.ts; raw handler because the signature
 * is computed over the exact request body bytes.
 */
export const POST: Endpoint = async (
  request,
  ctx?: { params?: Record<string, string> },
) => {
  const connectionId = connectionIdFrom(request, ctx?.params)
  if (!connectionId) return jsonError('Unknown connection', 404)

  const connection = await getConnection(connectionId)
  if (
    !connection ||
    connection.provider !== 'stripe' ||
    connection.status === 'disconnected'
  ) {
    return jsonError('Unknown connection', 404)
  }

  const rawBody = await request.text()
  const { ctx: connectorCtx } = await buildConnectorContext(connection.id)

  let parsed: Awaited<ReturnType<typeof stripeConnector.parseWebhook>>
  try {
    parsed = await stripeConnector.parseWebhook({
      rawBody,
      headers: request.headers,
      webhookSecret: connectorCtx.credentials.webhookSecret ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bad signature'
    console.warn('[engine:stripe] webhook rejected', connection.id, message)
    return jsonError(message, 400)
  }
  if (!parsed) return Response.json({ received: true })

  // one engineEvent per stripe event id makes redeliveries a no-op
  const [receipt] = await drizzle
    .insert(engineEvent)
    .values({
      id: newId('ev'),
      workspaceId: connection.workspaceId,
      type: 'webhook',
      source: WEBHOOK_SOURCE,
      sourceEventId: `${WEBHOOK_SOURCE}:${parsed.eventId}`,
      properties: { stripeType: parsed.type, connectionId: connection.id },
      occurredAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning({ id: engineEvent.id })
  if (!receipt) {
    return Response.json({ received: true, duplicate: true })
  }

  if (parsed.order) {
    try {
      const result = await upsertOrderFromRevenue(
        connection.workspaceId,
        'stripe',
        parsed.order,
      )
      connectorCtx.log('webhook order upserted', {
        type: parsed.type,
        orderId: result.orderId,
        created: result.created,
      })
    } catch (error) {
      // release the dedupe row so stripe's retry can try again
      await drizzle
        .delete(engineEvent)
        .where(
          and(eq(engineEvent.id, receipt.id), eq(engineEvent.source, WEBHOOK_SOURCE)),
        )
      console.error('[engine:stripe] webhook order failed', connection.id, error)
      return jsonError('Failed to record order', 500)
    }
  }

  return Response.json({ received: true })
}
