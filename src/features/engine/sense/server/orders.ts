import { and, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineContact,
  engineEvent,
  engineOrder,
  engineOutcome,
  engineProduct,
} from '~/database/engineSchema'

import { newId } from '../../core/ids'
import { estimateCostMinor, grossProfitMinor } from '../../core/money'
import { resolveContact } from './identity'

import type { RevenueOrder } from '../../channels/ChannelConnector'
import type { IdentityHint } from './identity'

const PAID_STATUSES = new Set<RevenueOrder['status']>([
  'paid',
  'partially_refunded',
  'refunded',
])

export type UpsertOrderResult = {
  orderId: string
  contactId: string | null
  created: boolean
  isFirstOrder: boolean
  grossProfitMinor: number
}

/** workspace-level fallback: average margin of products that declare one, else 0 */
export async function workspaceMarginRate(workspaceId: string) {
  const [row] = await drizzle
    .select({ rate: sql<number | null>`avg(${engineProduct.grossMarginRate})` })
    .from(engineProduct)
    .where(
      and(
        eq(engineProduct.workspaceId, workspaceId),
        isNotNull(engineProduct.grossMarginRate),
      ),
    )
  const rate = row?.rate == null ? null : Number(row.rate)
  return rate != null && Number.isFinite(rate) ? rate : null
}

function splitName(name: string | null | undefined) {
  const trimmed = name?.trim()
  if (!trimmed) return { firstName: null, lastName: null }
  const [firstName, ...rest] = trimmed.split(/\s+/)
  return { firstName: firstName ?? null, lastName: rest.length ? rest.join(' ') : null }
}

async function resolveOrderContact(
  workspaceId: string,
  source: string,
  order: RevenueOrder,
) {
  const { email, externalId, name } = order.customer
  if (!email && !externalId) return null
  const identities: IdentityHint[] = externalId
    ? [
        source === 'stripe'
          ? { kind: 'stripe_customer', provider: 'stripe', value: externalId }
          : { kind: 'crm_id', provider: source, value: externalId },
      ]
    : []
  return resolveContact({
    workspaceId,
    email,
    ...splitName(name),
    source,
    identities,
    externalIds: externalId ? { [source]: externalId } : undefined,
    activityAt: order.occurredAt,
  })
}

async function existingOrderContactId(
  workspaceId: string,
  source: string,
  order: RevenueOrder,
) {
  const [existing] = await drizzle
    .select({ contactId: engineOrder.contactId })
    .from(engineOrder)
    .where(
      and(
        eq(engineOrder.workspaceId, workspaceId),
        eq(engineOrder.source, source),
        eq(engineOrder.externalId, order.externalId),
      ),
    )
    .limit(1)
  return existing?.contactId ?? null
}

async function hasEarlierPaidOrder(
  workspaceId: string,
  contactId: string,
  source: string,
  order: RevenueOrder,
) {
  const [row] = await drizzle
    .select({ id: engineOrder.id })
    .from(engineOrder)
    .where(
      and(
        eq(engineOrder.workspaceId, workspaceId),
        eq(engineOrder.contactId, contactId),
        lt(engineOrder.occurredAt, order.occurredAt),
        sql`${engineOrder.status} IN ('paid', 'partially_refunded', 'refunded')`,
        sql`NOT (${engineOrder.source} = ${source} AND ${engineOrder.externalId} = ${order.externalId})`,
      ),
    )
    .limit(1)
  return !!row
}

/**
 * idempotent revenue ingestion: one engineOrder per (workspace, source, externalId),
 * with the contact resolved, cost estimated, gross profit recomputed, and the
 * matching outcome + purchase event written once.
 */
export async function upsertOrderFromRevenue(
  workspaceId: string,
  source: string,
  order: RevenueOrder,
): Promise<UpsertOrderResult> {
  const contact = await resolveOrderContact(workspaceId, source, order)
  // refund webhooks can arrive without customer details; keep the link a previous sync made
  const contactId =
    contact?.id ?? (await existingOrderContactId(workspaceId, source, order))

  const costMinor =
    order.costMinor > 0
      ? order.costMinor
      : estimateCostMinor({
          revenueMinor: order.revenueMinor,
          grossMarginRate: await workspaceMarginRate(workspaceId),
        })
  const profit = grossProfitMinor({
    revenueMinor: order.revenueMinor,
    costMinor,
    feesMinor: order.feesMinor,
    refundedMinor: order.refundedMinor,
  })

  const isPaid = PAID_STATUSES.has(order.status)
  const isFirstOrder =
    isPaid &&
    !!contactId &&
    !(await hasEarlierPaidOrder(workspaceId, contactId, source, order))

  const now = new Date().toISOString()
  const values = {
    contactId,
    status: order.status,
    currency: order.currency.toUpperCase(),
    revenueMinor: order.revenueMinor,
    costMinor,
    feesMinor: order.feesMinor,
    refundedMinor: order.refundedMinor,
    grossProfitMinor: profit,
    isFirstOrder,
    lineItems: order.lineItems,
    occurredAt: order.occurredAt,
    raw: order.raw ?? null,
    updatedAt: now,
  }

  const [row] = await drizzle
    .insert(engineOrder)
    .values({
      id: newId('ord'),
      workspaceId,
      source,
      externalId: order.externalId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [engineOrder.workspaceId, engineOrder.source, engineOrder.externalId],
      set: values,
    })
    .returning({ id: engineOrder.id, inserted: sql<boolean>`(xmax = 0)` })
  if (!row) throw new Error('order upsert returned no row')

  // one purchase outcome per order: re-syncs update it so refunds lower its profit
  // and a reclassified first order never leaves a second row behind
  const outcomeValues = {
    contactId,
    type: isFirstOrder ? 'first_purchase' : 'purchase',
    grossProfitMinor: profit,
    currency: values.currency,
    occurredAt: order.occurredAt,
  }
  const updatedOutcomes = await drizzle
    .update(engineOutcome)
    .set(outcomeValues)
    .where(
      and(
        eq(engineOutcome.workspaceId, workspaceId),
        eq(engineOutcome.orderId, row.id),
        inArray(engineOutcome.type, ['purchase', 'first_purchase']),
      ),
    )
    .returning({ id: engineOutcome.id })

  if (isPaid) {
    if (updatedOutcomes.length === 0) {
      await drizzle
        .insert(engineOutcome)
        .values({ id: newId('out'), workspaceId, orderId: row.id, ...outcomeValues })
        .onConflictDoNothing()
    }

    await drizzle
      .insert(engineEvent)
      .values({
        id: newId('ev'),
        workspaceId,
        contactId,
        type: 'purchase',
        channelKey: null,
        source,
        sourceEventId: `${source}:${order.externalId}`,
        valueMinor: order.revenueMinor,
        currency: values.currency,
        properties: { orderId: row.id, status: order.status, isFirstOrder },
        occurredAt: order.occurredAt,
      })
      .onConflictDoNothing()

    if (contact && contact.lifecycleStage !== 'customer') {
      await drizzle
        .update(engineContact)
        .set({ lifecycleStage: 'customer', updatedAt: now })
        .where(
          and(
            eq(engineContact.id, contact.id),
            ne(engineContact.lifecycleStage, 'customer'),
          ),
        )
    }
  }

  return {
    orderId: row.id,
    contactId,
    created: row.inserted,
    isFirstOrder,
    grossProfitMinor: profit,
  }
}
