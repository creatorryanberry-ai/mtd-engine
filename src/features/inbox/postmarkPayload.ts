import { parseInboundRecipientToken } from './inboundToken'

export type PostmarkInboundAttachment = {
  Name?: string
  Content?: string
  ContentType?: string
  ContentLength?: number
  ContentID?: string
}

export type PostmarkInboundPayload = {
  From?: string
  FromFull?: { Email?: string; Name?: string }
  To?: string
  OriginalRecipient?: string
  ToFull?: Array<{ Email?: string; Name?: string }>
  Subject?: string
  MessageID?: string
  Date?: string
  TextBody?: string
  HtmlBody?: string
  Attachments?: PostmarkInboundAttachment[]
}

export function asPostmarkInboundPayload(value: unknown): PostmarkInboundPayload | null {
  if (!value || typeof value !== 'object') return null
  return value as PostmarkInboundPayload
}

export function resolvePostmarkRecipientToken(
  payload: PostmarkInboundPayload,
  domain: string,
) {
  const candidates = [
    payload.OriginalRecipient,
    payload.To,
    ...(payload.ToFull ?? []).map((entry) => entry.Email),
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const token = parseInboundRecipientToken(candidate, domain)
    if (token) return { token, toAddress: candidate }
  }
  return null
}

export function resolvePostmarkFromAddress(payload: PostmarkInboundPayload) {
  return payload.FromFull?.Email?.trim() || payload.From?.trim() || 'unknown'
}

export function parsePostmarkReceivedAt(value: string | undefined, fallback: Date) {
  if (!value) return fallback.toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback.toISOString()
  return parsed.toISOString()
}
