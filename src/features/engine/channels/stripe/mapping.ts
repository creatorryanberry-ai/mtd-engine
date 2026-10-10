import type { RevenueOrder } from '../ChannelConnector'

/** the subset of a stripe charge object we read; everything else stays in raw */
export type StripeCharge = {
  id: string
  object?: string
  amount: number
  amount_refunded?: number | null
  currency: string
  created: number
  status: 'succeeded' | 'pending' | 'failed'
  refunded?: boolean
  paid?: boolean
  description?: string | null
  customer?: string | { id: string } | null
  receipt_email?: string | null
  billing_details?: { email?: string | null; name?: string | null } | null
  balance_transaction?: string | { id?: string; fee?: number | null } | null
  metadata?: Record<string, string> | null
}

export type StripeEvent = {
  id: string
  type: string
  created?: number
  data: { object: Record<string, unknown> }
}

export const STRIPE_ORDER_EVENT_TYPES = new Set([
  'charge.succeeded',
  'charge.refunded',
  'charge.updated',
])

export function stripeOrderStatus(charge: StripeCharge): RevenueOrder['status'] {
  if (charge.status === 'failed') return 'failed'
  if (charge.status === 'pending') return 'pending'
  const refunded = charge.amount_refunded ?? 0
  if (refunded > 0 && refunded >= charge.amount) return 'refunded'
  if (refunded > 0) return 'partially_refunded'
  return 'paid'
}

export function stripeCustomerId(charge: StripeCharge) {
  if (!charge.customer) return undefined
  return typeof charge.customer === 'string' ? charge.customer : charge.customer.id
}

export function stripeFeeMinor(charge: StripeCharge) {
  const tx = charge.balance_transaction
  if (!tx || typeof tx === 'string') return 0
  return tx.fee ?? 0
}

export function isStripeCharge(value: unknown): value is StripeCharge {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.amount === 'number' &&
    typeof record.currency === 'string' &&
    typeof record.created === 'number' &&
    typeof record.status === 'string'
  )
}

/** cost is 0 here; the order service estimates it from product margin */
export function chargeToRevenueOrder(charge: StripeCharge): RevenueOrder {
  const email = charge.billing_details?.email ?? charge.receipt_email ?? null
  const description = charge.description?.trim()
  return {
    externalId: charge.id,
    status: stripeOrderStatus(charge),
    currency: charge.currency.toUpperCase(),
    revenueMinor: charge.amount,
    costMinor: 0,
    feesMinor: stripeFeeMinor(charge),
    refundedMinor: charge.amount_refunded ?? 0,
    occurredAt: new Date(charge.created * 1000).toISOString(),
    customer: {
      externalId: stripeCustomerId(charge),
      email,
      name: charge.billing_details?.name ?? null,
    },
    lineItems: [
      {
        name: description || 'Stripe charge',
        quantity: 1,
        amountMinor: charge.amount,
      },
    ],
    raw: charge as unknown as Record<string, unknown>,
  }
}
