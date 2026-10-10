import { and, desc, eq, lt, or } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { engineEvent } from '~/database/engineSchema'

import { newId } from '../../core/ids'
import { decodeCursor, encodeCursor, pageLimit, toPage } from '../../core/pagination'
import { resolveContact } from './identity'

import type { PageQuery } from '../../core/pagination'
import type { IngestEventInput } from '../../contract'

export type IngestResult = { accepted: number; duplicates: number; ids: string[] }

/**
 * ingest a batch of touches. an email resolves (or creates) the contact; rows
 * carrying a sourceEventId are idempotent per (workspace, source, sourceEventId).
 */
export async function ingestEvents(
  workspaceId: string,
  events: IngestEventInput[],
  source = 'api',
): Promise<IngestResult> {
  if (events.length === 0) return { accepted: 0, duplicates: 0, ids: [] }
  const now = new Date().toISOString()

  const values: (typeof engineEvent.$inferInsert)[] = []
  for (const event of events) {
    const eventSource = event.source ?? source
    const occurredAt = event.occurredAt ?? now
    let contactId = event.contactId ?? null
    if (!contactId && event.email) {
      const contact = await resolveContact({
        workspaceId,
        email: event.email,
        source: eventSource,
        activityAt: occurredAt,
      })
      contactId = contact.id
    }
    values.push({
      id: newId('ev'),
      workspaceId,
      contactId,
      anonymousId: event.anonymousId ?? null,
      type: event.type,
      channelKey: event.channelKey ?? null,
      campaignId: event.campaignId ?? null,
      assetVariantId: event.assetVariantId ?? null,
      experimentId: event.experimentId ?? null,
      armId: event.armId ?? null,
      source: eventSource,
      sourceEventId: event.sourceEventId ?? null,
      valueMinor: event.valueMinor ?? null,
      currency: event.currency ?? null,
      properties: event.properties ?? {},
      occurredAt,
      receivedAt: now,
    })
  }

  const inserted = await drizzle
    .insert(engineEvent)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: engineEvent.id })

  const ids = inserted.map((row) => row.id)
  return { accepted: ids.length, duplicates: values.length - ids.length, ids }
}

/** newest first, keyset on occurredAt|id */
export async function listEvents(workspaceId: string, query: PageQuery) {
  const limit = pageLimit(query.limit)
  const cursor = decodeCursor(query.cursor)

  const rows = await drizzle
    .select({
      id: engineEvent.id,
      workspaceId: engineEvent.workspaceId,
      contactId: engineEvent.contactId,
      anonymousId: engineEvent.anonymousId,
      type: engineEvent.type,
      channelKey: engineEvent.channelKey,
      campaignId: engineEvent.campaignId,
      source: engineEvent.source,
      sourceEventId: engineEvent.sourceEventId,
      valueMinor: engineEvent.valueMinor,
      currency: engineEvent.currency,
      properties: engineEvent.properties,
      occurredAt: engineEvent.occurredAt,
      receivedAt: engineEvent.receivedAt,
    })
    .from(engineEvent)
    .where(
      and(
        eq(engineEvent.workspaceId, workspaceId),
        cursor
          ? or(
              lt(engineEvent.occurredAt, cursor.ts),
              and(eq(engineEvent.occurredAt, cursor.ts), lt(engineEvent.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(engineEvent.occurredAt), desc(engineEvent.id))
    .limit(limit + 1)

  return toPage(rows, limit, (row) => encodeCursor(row.occurredAt, row.id))
}
