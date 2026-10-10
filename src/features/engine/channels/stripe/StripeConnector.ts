import { server } from '~/env'

import { ConnectorHttpError } from '../errors'
import {
  chargeToRevenueOrder,
  isStripeCharge,
  STRIPE_ORDER_EVENT_TYPES,
  type StripeCharge,
  type StripeEvent,
} from './mapping'
import { verifyStripeSignature } from './signature'

import type {
  ConnectorContext,
  ConnectorHealth,
  ConnectResult,
  RevenueConnector,
  RevenueOrder,
} from '../ChannelConnector'

const STRIPE_API = 'https://api.stripe.com'
const PAGE_SIZE = 100

type StripeList<T> = { object: 'list'; data: T[]; has_more: boolean }

async function stripeFetch<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`${STRIPE_API}${path}`, {
    headers: { authorization: `Bearer ${apiKey}`, 'stripe-version': '2024-06-20' },
  })
  const text = await response.text()
  if (!response.ok) throw new ConnectorHttpError('stripe', response.status, text)
  return JSON.parse(text) as T
}

function apiKeyFrom(ctx: ConnectorContext) {
  const key = ctx.credentials.apiKey || server.STRIPE_SECRET_KEY
  if (!key) throw new Error('Stripe api key missing on this connection')
  return key
}

export class StripeConnector implements RevenueConnector {
  readonly key = 'stripe'
  readonly displayName = 'Stripe'
  readonly kind = 'revenue' as const
  readonly scopes = ['charges:read', 'balance:read', 'balance_transactions:read']

  /** stripe never needs platform config; workspaces bring a restricted key */
  isConfigured() {
    return true
  }

  async connect(_input: {
    workspaceId: string
    userId: string
    returnTo?: string | null
  }): Promise<ConnectResult> {
    return { authorizeUrl: null }
  }

  async healthCheck(ctx: ConnectorContext): Promise<ConnectorHealth> {
    const checkedAt = new Date().toISOString()
    try {
      const balance = await stripeFetch<{
        livemode?: boolean
        available?: { amount: number; currency: string }[]
      }>(apiKeyFrom(ctx), '/v1/balance')
      const available = balance.available?.[0]
      const detail = available
        ? `${balance.livemode ? 'live' : 'test'} mode, available ${available.amount} ${available.currency.toUpperCase()}`
        : `${balance.livemode ? 'live' : 'test'} mode`
      return { ok: true, checkedAt, detail, tokenExpiresAt: null }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return { ok: false, checkedAt, detail, tokenExpiresAt: null }
    }
  }

  async syncOrders(
    ctx: ConnectorContext,
    cursor?: string | null,
  ): Promise<{ orders: RevenueOrder[]; cursor: string | null; hasMore: boolean }> {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    params.append('expand[]', 'data.balance_transaction')
    if (cursor) params.set('starting_after', cursor)

    const page = await stripeFetch<StripeList<StripeCharge>>(
      apiKeyFrom(ctx),
      `/v1/charges?${params.toString()}`,
    )
    const orders = page.data
      .filter((charge) => charge.status === 'succeeded')
      .map(chargeToRevenueOrder)
    const last = page.data.at(-1)
    const hasMore = page.has_more && !!last
    return { orders, cursor: hasMore ? last.id : null, hasMore }
  }

  /**
   * verifies the stripe-signature header with the connection's webhook secret
   * (falls back to the platform secret) and normalises charge events.
   */
  async parseWebhook(input: {
    rawBody: string
    headers: Headers
    webhookSecret?: string | null
  }): Promise<{ eventId: string; order: RevenueOrder | null; type: string } | null> {
    const secret = input.webhookSecret || server.STRIPE_WEBHOOK_SECRET
    if (!secret) throw new Error('Stripe webhook secret is not configured')

    const check = verifyStripeSignature({
      rawBody: input.rawBody,
      header: input.headers.get('stripe-signature'),
      secret,
    })
    if (!check.ok) throw new Error(`Invalid Stripe signature (${check.reason})`)

    let event: StripeEvent
    try {
      event = JSON.parse(input.rawBody) as StripeEvent
    } catch {
      throw new Error('Stripe webhook body is not json')
    }
    if (!event || typeof event.id !== 'string' || typeof event.type !== 'string') {
      throw new Error('Stripe webhook body is not an event')
    }

    if (!STRIPE_ORDER_EVENT_TYPES.has(event.type)) {
      return { eventId: event.id, order: null, type: event.type }
    }
    const object = event.data?.object
    if (!isStripeCharge(object)) {
      return { eventId: event.id, order: null, type: event.type }
    }
    return { eventId: event.id, order: chargeToRevenueOrder(object), type: event.type }
  }
}

export const stripeConnector = new StripeConnector()
