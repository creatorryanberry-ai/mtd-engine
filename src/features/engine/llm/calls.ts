import { and, desc, eq, lt, or } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineLlmCall } from '~/database/engineSchema'
import {
  decodeCursor,
  encodeCursor,
  pageLimit,
  toPage,
} from '~/features/engine/core/pagination'

import type { PageQuery } from '~/features/engine/core/pagination'

/** newest first, keyset on createdAt|id; prompts and outputs stay out of the list */
export async function listLlmCalls(workspaceId: string, query: PageQuery) {
  const limit = pageLimit(query.limit)
  const cursor = decodeCursor(query.cursor)

  const rows = await drizzle
    .select({
      id: engineLlmCall.id,
      agent: engineLlmCall.agent,
      tier: engineLlmCall.tier,
      model: engineLlmCall.model,
      purpose: engineLlmCall.purpose,
      inputTokens: engineLlmCall.inputTokens,
      outputTokens: engineLlmCall.outputTokens,
      cacheReadTokens: engineLlmCall.cacheReadTokens,
      costMicros: engineLlmCall.costMicros,
      latencyMs: engineLlmCall.latencyMs,
      error: engineLlmCall.error,
      createdAt: engineLlmCall.createdAt,
    })
    .from(engineLlmCall)
    .where(
      and(
        eq(engineLlmCall.workspaceId, workspaceId),
        cursor
          ? or(
              lt(engineLlmCall.createdAt, cursor.ts),
              and(
                eq(engineLlmCall.createdAt, cursor.ts),
                lt(engineLlmCall.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(engineLlmCall.createdAt), desc(engineLlmCall.id))
    .limit(limit + 1)

  return toPage(rows, limit, (row) => encodeCursor(row.createdAt, row.id))
}
