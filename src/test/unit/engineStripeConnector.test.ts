import { describe, expect, it } from 'vitest'

import {
  chargeToRevenueOrder,
  stripeOrderStatus,
  type StripeCharge,
} from '~/features/engine/channels/stripe/mapping'
import {
  buildStripeSignatureHeader,
  computeStripeSignature,
  parseStripeSignatureHeader,
  verifyStripeSignature,
} from '~/features/engine/channels/stripe/signature'
import { StripeConnector } from '~/features/engine/channels/stripe/StripeConnector'

const SECRET = 'whsec_test_secret_123'
const NOW = 1_760_000_000

function charge(overrides: Partial<StripeCharge> = {}): StripeCharge {
  return {
    id: 'ch_123',
    object: 'charge',
    amount: 12_000,
    amount_refunded: 0,
    currency: 'gbp',
    created: 1_759_990_000,
    status: 'succeeded',
    paid: true,
    refunded: false,
    description: 'Roof inspection',
    customer: 'cus_abc',
    receipt_email: 'receipt@example.com',
    billing_details: { email: 'jane@example.com', name: 'Jane Roofer' },
    balance_transaction: { id: 'txn_1', fee: 378 },
    ...overrides,
  }
}

describe('stripe signature verification', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'charge.succeeded' })

  it('accepts a header signed with the secret inside the tolerance', () => {
    const header = buildStripeSignatureHeader(body, SECRET, NOW)
    const result = verifyStripeSignature({
      rawBody: body,
      header,
      secret: SECRET,
      nowSeconds: NOW + 60,
    })
    expect(result).toEqual({ ok: true, timestamp: NOW })
  })

  it('parses multiple v1 signatures and accepts when any matches', () => {
    const good = computeStripeSignature(NOW, body, SECRET)
    const header = `t=${NOW},v1=${'0'.repeat(64)},v1=${good}`
    expect(parseStripeSignatureHeader(header)?.signatures).toHaveLength(2)
    const result = verifyStripeSignature({
      rawBody: body,
      header,
      secret: SECRET,
      nowSeconds: NOW,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a wrong secret, a tampered body and a stale timestamp', () => {
    const header = buildStripeSignatureHeader(body, SECRET, NOW)
    expect(
      verifyStripeSignature({
        rawBody: body,
        header,
        secret: 'whsec_other',
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' })
    expect(
      verifyStripeSignature({
        rawBody: `${body} `,
        header,
        secret: SECRET,
        nowSeconds: NOW,
      }),
    ).toEqual({ ok: false, reason: 'mismatch' })
    expect(
      verifyStripeSignature({
        rawBody: body,
        header,
        secret: SECRET,
        nowSeconds: NOW + 301,
      }),
    ).toEqual({ ok: false, reason: 'expired' })
  })

  it('rejects missing or malformed headers', () => {
    expect(
      verifyStripeSignature({ rawBody: body, header: null, secret: SECRET }),
    ).toEqual({
      ok: false,
      reason: 'missing_header',
    })
    expect(
      verifyStripeSignature({ rawBody: body, header: 'v1=abc', secret: SECRET }),
    ).toEqual({
      ok: false,
      reason: 'malformed',
    })
    expect(
      verifyStripeSignature({ rawBody: body, header: 't=123', secret: SECRET }),
    ).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })
})

describe('stripe charge mapping', () => {
  it('maps a succeeded charge to a paid revenue order', () => {
    const order = chargeToRevenueOrder(charge())
    expect(order).toMatchObject({
      externalId: 'ch_123',
      status: 'paid',
      currency: 'GBP',
      revenueMinor: 12_000,
      costMinor: 0,
      feesMinor: 378,
      refundedMinor: 0,
      occurredAt: new Date(1_759_990_000 * 1000).toISOString(),
      customer: { externalId: 'cus_abc', email: 'jane@example.com', name: 'Jane Roofer' },
      lineItems: [{ name: 'Roof inspection', quantity: 1, amountMinor: 12_000 }],
    })
    expect(order.raw?.id).toBe('ch_123')
  })

  it('falls back to receipt email, expanded customer object and a default line item', () => {
    const order = chargeToRevenueOrder(
      charge({
        billing_details: null,
        description: null,
        customer: { id: 'cus_obj' },
        balance_transaction: 'txn_unexpanded',
      }),
    )
    expect(order.customer).toEqual({
      externalId: 'cus_obj',
      email: 'receipt@example.com',
      name: null,
    })
    expect(order.lineItems[0]?.name).toBe('Stripe charge')
    expect(order.feesMinor).toBe(0)
  })

  it('derives refund status from amount_refunded', () => {
    expect(stripeOrderStatus(charge({ amount_refunded: 0 }))).toBe('paid')
    expect(stripeOrderStatus(charge({ amount_refunded: 2_000 }))).toBe(
      'partially_refunded',
    )
    expect(stripeOrderStatus(charge({ amount_refunded: 12_000, refunded: true }))).toBe(
      'refunded',
    )
    expect(stripeOrderStatus(charge({ status: 'pending' }))).toBe('pending')
    expect(stripeOrderStatus(charge({ status: 'failed' }))).toBe('failed')

    const partial = chargeToRevenueOrder(charge({ amount_refunded: 2_000 }))
    expect(partial.refundedMinor).toBe(2_000)
    expect(partial.revenueMinor).toBe(12_000)
  })
})

describe('stripe webhook parsing', () => {
  const connector = new StripeConnector()

  function event(type: string, object: unknown) {
    return JSON.stringify({ id: `evt_${type}`, type, data: { object } })
  }

  function request(
    body: string,
    header = buildStripeSignatureHeader(body, SECRET, Math.floor(Date.now() / 1000)),
  ) {
    return {
      rawBody: body,
      headers: new Headers({ 'stripe-signature': header }),
      webhookSecret: SECRET,
    }
  }

  it('returns an order for charge.refunded and null for unrelated events', async () => {
    const refunded = await connector.parseWebhook(
      request(
        event('charge.refunded', charge({ amount_refunded: 12_000, refunded: true })),
      ),
    )
    expect(refunded).toMatchObject({
      eventId: 'evt_charge.refunded',
      type: 'charge.refunded',
      order: { status: 'refunded', refundedMinor: 12_000 },
    })

    const other = await connector.parseWebhook(
      request(event('customer.created', { id: 'cus_1' })),
    )
    expect(other).toEqual({
      eventId: 'evt_customer.created',
      type: 'customer.created',
      order: null,
    })
  })

  it('throws on a bad signature so the route can answer 400', async () => {
    const body = event('charge.succeeded', charge())
    await expect(
      connector.parseWebhook(
        request(body, buildStripeSignatureHeader(body, 'whsec_wrong', NOW)),
      ),
    ).rejects.toThrow(/Invalid Stripe signature/)
  })
})
