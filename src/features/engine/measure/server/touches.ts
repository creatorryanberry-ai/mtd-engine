import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  sql,
} from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineDeal,
  engineEvent,
  engineOrder,
  engineOutcome,
} from '~/database/engineSchema'

import { OUTCOME_TYPES, TOUCH_EVENT_TYPES, parseTimestamp } from '../attribution'

import type { Touch } from '../attribution'

/** orders that never became revenue; outcomes tied to them are ignored */
export const NON_REVENUE_ORDER_STATUSES = ['pending', 'failed']

const DAY_MS = 24 * 60 * 60 * 1000

/** outcomes without an order (deals) count; outcomes on pending/failed orders do not */
function revenueOrderOnly() {
  return or(
    isNull(engineOrder.status),
    notInArray(engineOrder.status, NON_REVENUE_ORDER_STATUSES),
  )
}

export type OutcomeWithTouches = {
  id: string
  contactId: string
  type: string
  occurredAt: string
  grossProfitMinor: number
  revenueMinor: number
  touches: Touch[]
}

/**
 * outcomes with a contact in [from, to), newest first, each with that contact's
 * touches inside the lookback (outcome - lookbackDays .. outcome). revenue is the
 * order's revenue, else the won deal's amount, else 0.
 */
export async function loadOutcomesWithTouches(input: {
  workspaceId: string
  fromIso: string
  toIso: string
  lookbackDays: number
  limit?: number
}): Promise<OutcomeWithTouches[]> {
  const { workspaceId, fromIso, toIso, lookbackDays } = input
  const baseQuery = drizzle
    .select({
      id: engineOutcome.id,
      contactId: engineOutcome.contactId,
      type: engineOutcome.type,
      occurredAt: engineOutcome.occurredAt,
      grossProfitMinor: engineOutcome.grossProfitMinor,
      orderRevenue: engineOrder.revenueMinor,
      dealAmount: engineDeal.amountMinor,
    })
    .from(engineOutcome)
    .leftJoin(engineOrder, eq(engineOrder.id, engineOutcome.orderId))
    .leftJoin(engineDeal, eq(engineDeal.id, engineOutcome.dealId))
    .where(
      and(
        eq(engineOutcome.workspaceId, workspaceId),
        inArray(engineOutcome.type, [...OUTCOME_TYPES]),
        isNotNull(engineOutcome.contactId),
        gte(engineOutcome.occurredAt, fromIso),
        lt(engineOutcome.occurredAt, toIso),
        revenueOrderOnly(),
      ),
    )
    .orderBy(desc(engineOutcome.occurredAt), desc(engineOutcome.id))
  const rows = await (input.limit ? baseQuery.limit(input.limit) : baseQuery)

  const outcomes = rows
  if (outcomes.length === 0) return []

  const contactIds = [...new Set(outcomes.map((row) => row.contactId!))]
  const oldest = Math.min(...outcomes.map((row) => parseTimestamp(row.occurredAt)))
  const newest = Math.max(...outcomes.map((row) => parseTimestamp(row.occurredAt)))
  const touchFrom = new Date(oldest - lookbackDays * DAY_MS).toISOString()
  const touchTo = new Date(newest).toISOString()

  const touchesByContact = new Map<
    string,
    { channelKey: string; time: number; occurredAt: string }[]
  >()
  const chunkSize = 1000
  for (let i = 0; i < contactIds.length; i += chunkSize) {
    const chunk = contactIds.slice(i, i + chunkSize)
    const touchRows = await drizzle
      .select({
        contactId: engineEvent.contactId,
        channelKey: engineEvent.channelKey,
        occurredAt: engineEvent.occurredAt,
      })
      .from(engineEvent)
      .where(
        and(
          eq(engineEvent.workspaceId, workspaceId),
          inArray(engineEvent.contactId, chunk),
          inArray(engineEvent.type, [...TOUCH_EVENT_TYPES]),
          isNotNull(engineEvent.channelKey),
          gte(engineEvent.occurredAt, touchFrom),
          lte(engineEvent.occurredAt, touchTo),
        ),
      )
    for (const touch of touchRows) {
      if (!touch.contactId || !touch.channelKey) continue
      const list = touchesByContact.get(touch.contactId) ?? []
      list.push({
        channelKey: touch.channelKey,
        occurredAt: touch.occurredAt,
        time: parseTimestamp(touch.occurredAt),
      })
      touchesByContact.set(touch.contactId, list)
    }
  }

  return outcomes.map((row) => {
    const at = parseTimestamp(row.occurredAt)
    const windowStart = at - lookbackDays * DAY_MS
    const touches = (touchesByContact.get(row.contactId!) ?? [])
      .filter((touch) => touch.time >= windowStart && touch.time <= at)
      .map((touch) => ({ channelKey: touch.channelKey, occurredAt: touch.occurredAt }))
    return {
      id: row.id,
      contactId: row.contactId!,
      type: row.type,
      occurredAt: row.occurredAt,
      grossProfitMinor: row.grossProfitMinor,
      revenueMinor: row.orderRevenue ?? row.dealAmount ?? 0,
      touches,
    }
  })
}

/** all outcomes in [from, to) regardless of contact: count and gross profit */
export async function outcomeTotals(workspaceId: string, fromIso: string, toIso: string) {
  const [row] = await drizzle
    .select({
      outcomes: sql<number>`count(*)::int`,
      grossProfit: sql<number>`coalesce(sum(${engineOutcome.grossProfitMinor}), 0)::float8`,
    })
    .from(engineOutcome)
    .leftJoin(engineOrder, eq(engineOrder.id, engineOutcome.orderId))
    .where(
      and(
        eq(engineOutcome.workspaceId, workspaceId),
        inArray(engineOutcome.type, [...OUTCOME_TYPES]),
        gte(engineOutcome.occurredAt, fromIso),
        lt(engineOutcome.occurredAt, toIso),
        revenueOrderOnly(),
      ),
    )
  return {
    outcomes: Number(row?.outcomes ?? 0),
    grossProfitMinor: Number(row?.grossProfit ?? 0),
  }
}
