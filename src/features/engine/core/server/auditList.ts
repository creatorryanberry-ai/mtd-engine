import { and, desc, eq, lt, or } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineAuditLog } from '~/database/engineSchema'

import { decodeCursor, encodeCursor, pageLimit, toPage } from '../pagination'

import type { PageQuery } from '../pagination'

/** newest first, keyset on createdAt|id */
export async function listAuditLog(workspaceId: string, query: PageQuery) {
  const limit = pageLimit(query.limit)
  const cursor = decodeCursor(query.cursor)

  const rows = await drizzle
    .select({
      id: engineAuditLog.id,
      workspaceId: engineAuditLog.workspaceId,
      actor: engineAuditLog.actor,
      action: engineAuditLog.action,
      entityType: engineAuditLog.entityType,
      entityId: engineAuditLog.entityId,
      before: engineAuditLog.before,
      after: engineAuditLog.after,
      reasoning: engineAuditLog.reasoning,
      evidence: engineAuditLog.evidence,
      autonomyLevel: engineAuditLog.autonomyLevel,
      createdAt: engineAuditLog.createdAt,
    })
    .from(engineAuditLog)
    .where(
      and(
        eq(engineAuditLog.workspaceId, workspaceId),
        cursor
          ? or(
              lt(engineAuditLog.createdAt, cursor.ts),
              and(
                eq(engineAuditLog.createdAt, cursor.ts),
                lt(engineAuditLog.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(engineAuditLog.createdAt), desc(engineAuditLog.id))
    .limit(limit + 1)

  return toPage(rows, limit, (row) => encodeCursor(row.createdAt, row.id))
}
