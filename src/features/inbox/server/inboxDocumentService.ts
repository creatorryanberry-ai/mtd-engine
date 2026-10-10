import { and, desc, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { inboxDocument, inboundEmail } from '~/database/schema'
import {
  deletePrivateReceipt,
  resolveAttachmentUrlForClient,
} from '~/features/upload/receiptStorage'

import type { InboxDocumentStatus } from '~/features/inbox/inboxStatuses'

export type InboxDocumentListItem = {
  id: string
  originalFileName: string
  mimeType: string
  fileSize: number
  source: string
  status: string
  receivedAt: string
  fromAddress: string | null
  subject: string | null
}

export type InboxDocumentDetail = InboxDocumentListItem & {
  previewUrl: string | null
  mtdTransactionId: string | null
  errorMessage: string | null
}

export type InboxEmailNoticeItem = {
  id: string
  status: string
  receivedAt: string
  fromAddress: string | null
  subject: string | null
  errorMessage: string | null
}

function notFound() {
  throw new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
}

export async function listInboxDocuments(userId: string) {
  const rows = await drizzle
    .select({
      id: inboxDocument.id,
      originalFileName: inboxDocument.originalFileName,
      mimeType: inboxDocument.mimeType,
      fileSize: inboxDocument.fileSize,
      source: inboxDocument.source,
      status: inboxDocument.status,
      receivedAt: inboxDocument.receivedAt,
      fromAddress: inboundEmail.fromAddress,
      subject: inboundEmail.subject,
    })
    .from(inboxDocument)
    .leftJoin(inboundEmail, eq(inboxDocument.inboundEmailId, inboundEmail.id))
    .where(and(eq(inboxDocument.userId, userId), eq(inboxDocument.status, 'New')))
    .orderBy(desc(inboxDocument.receivedAt))

  const notices = await drizzle
    .select({
      id: inboundEmail.id,
      status: inboundEmail.status,
      receivedAt: inboundEmail.receivedAt,
      fromAddress: inboundEmail.fromAddress,
      subject: inboundEmail.subject,
      errorMessage: inboundEmail.errorMessage,
    })
    .from(inboundEmail)
    .where(
      and(eq(inboundEmail.userId, userId), eq(inboundEmail.status, 'NoValidDocuments')),
    )
    .orderBy(desc(inboundEmail.receivedAt))
    .limit(20)

  return {
    items: rows satisfies InboxDocumentListItem[],
    waitingCount: rows.length,
    notices: notices satisfies InboxEmailNoticeItem[],
  }
}

export async function getInboxDocument(userId: string, id: string) {
  const [row] = await drizzle
    .select({
      id: inboxDocument.id,
      originalFileName: inboxDocument.originalFileName,
      mimeType: inboxDocument.mimeType,
      fileSize: inboxDocument.fileSize,
      source: inboxDocument.source,
      status: inboxDocument.status,
      receivedAt: inboxDocument.receivedAt,
      storagePath: inboxDocument.storagePath,
      mtdTransactionId: inboxDocument.mtdTransactionId,
      errorMessage: inboxDocument.errorMessage,
      fromAddress: inboundEmail.fromAddress,
      subject: inboundEmail.subject,
    })
    .from(inboxDocument)
    .leftJoin(inboundEmail, eq(inboxDocument.inboundEmailId, inboundEmail.id))
    .where(and(eq(inboxDocument.id, id), eq(inboxDocument.userId, userId)))
    .limit(1)

  if (!row) return null

  const previewUrl = await resolveAttachmentUrlForClient(row.storagePath, userId)
  return {
    id: row.id,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    source: row.source,
    status: row.status,
    receivedAt: row.receivedAt,
    fromAddress: row.fromAddress,
    subject: row.subject,
    previewUrl,
    mtdTransactionId: row.mtdTransactionId,
    errorMessage: row.errorMessage,
  } satisfies InboxDocumentDetail
}

export async function ignoreInboxDocument(userId: string, id: string) {
  const [updated] = await drizzle
    .update(inboxDocument)
    .set({ status: 'Ignored' satisfies InboxDocumentStatus })
    .where(and(eq(inboxDocument.id, id), eq(inboxDocument.userId, userId)))
    .returning({ id: inboxDocument.id })

  if (!updated) notFound()
  return { ok: true as const }
}

export async function markInboxDocumentProcessed(
  userId: string,
  id: string,
  mtdTransactionId: string,
) {
  const [existing] = await drizzle
    .select({ id: inboxDocument.id, storagePath: inboxDocument.storagePath })
    .from(inboxDocument)
    .where(and(eq(inboxDocument.id, id), eq(inboxDocument.userId, userId)))
    .limit(1)
  if (!existing) notFound()

  const [updated] = await drizzle
    .update(inboxDocument)
    .set({
      status: 'Processed' satisfies InboxDocumentStatus,
      processedAt: new Date().toISOString(),
      mtdTransactionId,
      storagePath: '',
    })
    .where(and(eq(inboxDocument.id, id), eq(inboxDocument.userId, userId)))
    .returning({ id: inboxDocument.id })

  if (!updated) notFound()

  try {
    await deletePrivateReceipt(existing.storagePath, userId)
  } catch (error) {
    console.info('[inbox] failed to delete processed attachment', {
      inboxDocumentId: id,
      userId,
      message: error instanceof Error ? error.message : 'unknown_error',
    })
  }

  return { ok: true as const }
}

export async function deleteInboxNotice(userId: string, id: string) {
  const [deleted] = await drizzle
    .delete(inboundEmail)
    .where(
      and(
        eq(inboundEmail.id, id),
        eq(inboundEmail.userId, userId),
        eq(inboundEmail.status, 'NoValidDocuments'),
      ),
    )
    .returning({ id: inboundEmail.id })
  if (!deleted) notFound()
  return { ok: true as const }
}

export async function clearUserInbox(userId: string) {
  await drizzle.delete(inboxDocument).where(eq(inboxDocument.userId, userId))
  await drizzle.delete(inboundEmail).where(eq(inboundEmail.userId, userId))
}
