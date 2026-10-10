import { and, desc, eq, lt, or } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineOrder } from '~/database/engineSchema'

import { decodeCursor, encodeCursor, pageLimit, toPage } from '../../core/pagination'

import type { PageQuery } from '../../core/pagination'

/** newest first, keyset on occurredAt|id (order upserts live in orders.ts) */
export async function listOrders(workspaceId: string, query: PageQuery) {
  const limit = pageLimit(query.limit)
  const cursor = decodeCursor(query.cursor)

  const rows = await drizzle
    .select({
      id: engineOrder.id,
      workspaceId: engineOrder.workspaceId,
      contactId: engineOrder.contactId,
      source: engineOrder.source,
      externalId: engineOrder.externalId,
      status: engineOrder.status,
      currency: engineOrder.currency,
      revenueMinor: engineOrder.revenueMinor,
      costMinor: engineOrder.costMinor,
      feesMinor: engineOrder.feesMinor,
      refundedMinor: engineOrder.refundedMinor,
      grossProfitMinor: engineOrder.grossProfitMinor,
      isFirstOrder: engineOrder.isFirstOrder,
      occurredAt: engineOrder.occurredAt,
    })
    .from(engineOrder)
    .where(
      and(
        eq(engineOrder.workspaceId, workspaceId),
        cursor
          ? or(
              lt(engineOrder.occurredAt, cursor.ts),
              and(eq(engineOrder.occurredAt, cursor.ts), lt(engineOrder.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(engineOrder.occurredAt), desc(engineOrder.id))
    .limit(limit + 1)

  return toPage(rows, limit, (row) => encodeCursor(row.occurredAt, row.id))
}
