import { and, eq } from 'drizzle-orm'
import { runWithUserDbContextAsync } from '@mtd/database'

import { drizzle } from '~/database/db'
import { inboxDocument, inboundEmail } from '~/database/schema'
import { notifyUser } from '~/api/notify'
import { filterInboundAttachments } from '~/features/inbox/filterAttachments'
import type { InboundEmailStatus } from '~/features/inbox/inboxStatuses'
import {
  asPostmarkInboundPayload,
  parsePostmarkReceivedAt,
  resolvePostmarkFromAddress,
  resolvePostmarkRecipientToken,
} from '~/features/inbox/postmarkPayload'
import { sha256Hex } from '~/features/inbox/sha256'
import { findActiveInboundEmailAddressByToken } from '~/features/inbox/server/inboundEmailAddressService'
import { uploadPrivateReceipt } from '~/features/upload/receiptStorage'

import type { PostmarkInboundPayload } from '~/features/inbox/postmarkPayload'

const NO_ATTACHMENT_META_PREFIX = 'no_attachment_meta:'
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function normalizeBodyText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function extractFirstUrl(...sources: Array<string | null | undefined>) {
  for (const source of sources) {
    if (!source) continue
    const match = source.match(URL_PATTERN)
    const first = match?.[0]
    if (first) return first
  }
  return null
}

function buildNoAttachmentMeta(payload: PostmarkInboundPayload) {
  const textBody = payload.TextBody?.trim() || ''
  const htmlBody = payload.HtmlBody?.trim() || ''
  const normalizedText = normalizeBodyText(textBody)
  const normalizedHtml = normalizeBodyText(stripHtml(htmlBody))
  const bodyPreview = (normalizedText || normalizedHtml).slice(0, 400) || null
  const linkUrl = extractFirstUrl(textBody, htmlBody)
  if (!bodyPreview && !linkUrl) return null
  return `${NO_ATTACHMENT_META_PREFIX}${JSON.stringify({ bodyPreview, linkUrl })}`
}

export type ProcessInboundResult = {
  ok: true
  status: 'ignored_unknown_recipient' | 'duplicate_message' | InboundEmailStatus
}

function buildInboxObjectKey(input: {
  userId: string
  inboundEmailId: string
  receivedAt: string
  fileName: string
}) {
  const received = new Date(input.receivedAt)
  const year = Number.isNaN(received.getTime())
    ? new Date().getUTCFullYear()
    : received.getUTCFullYear()
  const month = String(
    (Number.isNaN(received.getTime())
      ? new Date().getUTCMonth()
      : received.getUTCMonth()) + 1,
  ).padStart(2, '0')
  return `inbox/${input.userId}/email/${year}/${month}/${input.inboundEmailId}/${input.fileName}`
}

async function storeAttachments(input: {
  userId: string
  inboundEmailId: string
  receivedAt: string
  payload: PostmarkInboundPayload
}) {
  const { accepted, rejected } = filterInboundAttachments(
    (input.payload.Attachments ?? []).map((attachment) => ({
      name: attachment.Name,
      contentType: attachment.ContentType,
      contentLength: attachment.ContentLength,
      contentId: attachment.ContentID,
      content: attachment.Content,
    })),
  )
  let stored = 0
  let failed = 0
  const errors: string[] = []

  for (const attachment of accepted) {
    const hash = sha256Hex(attachment.bytes)
    const existingRows = await drizzle
      .select({
        id: inboxDocument.id,
        storagePath: inboxDocument.storagePath,
        status: inboxDocument.status,
      })
      .from(inboxDocument)
      .where(
        and(eq(inboxDocument.userId, input.userId), eq(inboxDocument.sha256Hash, hash)),
      )

    const waiting = existingRows.find((row) => row.status === 'New')
    if (waiting) {
      stored += 1
      continue
    }

    // always re-upload — processed/ignored rows may already have had the object deleted
    let storagePath = ''
    try {
      const uploaded = await uploadPrivateReceipt({
        userId: input.userId,
        fileName: attachment.sanitizedFileName,
        body: attachment.bytes,
        contentType: attachment.mimeType,
        key: buildInboxObjectKey({
          userId: input.userId,
          inboundEmailId: input.inboundEmailId,
          receivedAt: input.receivedAt,
          fileName: attachment.sanitizedFileName,
        }),
      })
      storagePath = uploaded.attachmentRef
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : 'storage_failed'
      errors.push(`${attachment.originalFileName}: storage_failed`)
      console.info('[inbound-email] store failed', {
        inboundEmailId: input.inboundEmailId,
        fileName: attachment.sanitizedFileName,
        message,
      })
      continue
    }

    await drizzle.insert(inboxDocument).values({
      id: crypto.randomUUID(),
      userId: input.userId,
      inboundEmailId: input.inboundEmailId,
      source: 'Email',
      originalFileName: attachment.originalFileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      storagePath,
      sha256Hash: hash,
      status: 'New',
      receivedAt: input.receivedAt,
    })
    stored += 1
  }

  if (rejected.length > 0) {
    console.info('[inbound-email] ignored attachments', {
      inboundEmailId: input.inboundEmailId,
      rejected: rejected.map((item) => ({
        fileName: item.originalFileName,
        reason: item.reason,
      })),
    })
  }

  return { stored, failed, acceptedCount: accepted.length, errors }
}

function emailStatusFor(result: {
  stored: number
  failed: number
  acceptedCount: number
}): InboundEmailStatus {
  if (result.acceptedCount === 0) return 'NoValidDocuments'
  if (result.failed > 0 && result.stored > 0) return 'PartiallyProcessed'
  if (result.failed > 0) return 'Failed'
  return 'Processed'
}

export async function processPostmarkInbound(
  payload: unknown,
  domain: string,
): Promise<ProcessInboundResult> {
  const parsed = asPostmarkInboundPayload(payload)
  if (!parsed?.MessageID) {
    throw new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
  }

  const recipient = resolvePostmarkRecipientToken(parsed, domain)
  if (!recipient) {
    console.info('[inbound-email] unknown or invalid recipient', {
      messageId: parsed.MessageID,
      originalRecipient: parsed.OriginalRecipient,
      to: parsed.To,
      domain,
    })
    return { ok: true, status: 'ignored_unknown_recipient' }
  }

  const address = await findActiveInboundEmailAddressByToken(recipient.token)
  if (!address) {
    console.info('[inbound-email] revoked or unknown token', {
      messageId: parsed.MessageID,
      token: recipient.token,
    })
    return { ok: true, status: 'ignored_unknown_recipient' }
  }

  const [existing] = await drizzle
    .select({ id: inboundEmail.id, status: inboundEmail.status })
    .from(inboundEmail)
    .where(
      and(
        eq(inboundEmail.provider, 'postmark'),
        eq(inboundEmail.providerMessageId, parsed.MessageID),
      ),
    )
    .limit(1)

  if (existing) {
    return { ok: true, status: 'duplicate_message' }
  }

  return runWithUserDbContextAsync(address.userId, async () => {
    const receivedAt = parsePostmarkReceivedAt(parsed.Date, new Date())
    const emailId = crypto.randomUUID()

    await drizzle.insert(inboundEmail).values({
      id: emailId,
      userId: address.userId,
      inboundEmailAddressId: address.id,
      provider: 'postmark',
      providerMessageId: parsed.MessageID!,
      fromAddress: resolvePostmarkFromAddress(parsed),
      toAddress: recipient.toAddress,
      subject: parsed.Subject?.trim() || null,
      receivedAt,
      status: 'Received',
    })

    try {
      const stored = await storeAttachments({
        userId: address.userId,
        inboundEmailId: emailId,
        receivedAt,
        payload: parsed,
      })
      const status = emailStatusFor(stored)
      const errorMessage =
        status === 'NoValidDocuments'
          ? buildNoAttachmentMeta(parsed)
          : stored.errors.length > 0
            ? stored.errors.slice(0, 5).join('; ')
            : null
      await drizzle
        .update(inboundEmail)
        .set({ status, errorMessage })
        .where(eq(inboundEmail.id, emailId))
      console.info('[inbound-email] stored', {
        emailId,
        status,
        stored: stored.stored,
        acceptedCount: stored.acceptedCount,
        failed: stored.failed,
      })
      if (stored.stored > 0) {
        await notifyUser(address.userId, { entity: 'inbox', id: emailId, status })
      }
      return { ok: true as const, status }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'processing_failed'
      console.info('[inbound-email] failed', { emailId, message })
      await drizzle
        .update(inboundEmail)
        .set({ status: 'Failed', errorMessage: 'processing_failed' })
        .where(eq(inboundEmail.id, emailId))
      return { ok: true as const, status: 'Failed' }
    }
  })
}
