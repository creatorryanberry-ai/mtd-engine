import { and, desc, eq, lt, or } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineContact } from '~/database/engineSchema'

import { decodeCursor, encodeCursor, pageLimit, toPage } from '../../core/pagination'

import type { PageQuery } from '../../core/pagination'

/** newest first, keyset on createdAt|id */
export async function listContacts(workspaceId: string, query: PageQuery) {
  const limit = pageLimit(query.limit)
  const cursor = decodeCursor(query.cursor)

  const rows = await drizzle
    .select({
      id: engineContact.id,
      workspaceId: engineContact.workspaceId,
      companyId: engineContact.companyId,
      email: engineContact.email,
      firstName: engineContact.firstName,
      lastName: engineContact.lastName,
      jobTitle: engineContact.jobTitle,
      lifecycleStage: engineContact.lifecycleStage,
      upliftClass: engineContact.upliftClass,
      leadScore: engineContact.leadScore,
      source: engineContact.source,
      lastActivityAt: engineContact.lastActivityAt,
      createdAt: engineContact.createdAt,
    })
    .from(engineContact)
    .where(
      and(
        eq(engineContact.workspaceId, workspaceId),
        cursor
          ? or(
              lt(engineContact.createdAt, cursor.ts),
              and(
                eq(engineContact.createdAt, cursor.ts),
                lt(engineContact.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(engineContact.createdAt), desc(engineContact.id))
    .limit(limit + 1)

  return toPage(rows, limit, (row) => encodeCursor(row.createdAt, row.id))
}
