export const INBOUND_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export const INBOUND_MIN_IMAGE_BYTES = 8 * 1024
export const INBOUND_MIN_PDF_BYTES = 256
export const INBOUND_MAX_FILE_BYTES = 10 * 1024 * 1024

const JUNK_NAME_PATTERN =
  /^(logo|signature|spacer|facebook|twitter|linkedin|icon|banner|pixel)([._-].*)?$/i

const ACCEPTED_EXTENSIONS = new Set(['pdf', 'jpeg', 'jpg', 'png', 'webp', 'heic', 'heif'])

export type InboundAttachmentInput = {
  name?: string | null
  contentType?: string | null
  contentLength?: number | null
  contentId?: string | null
  content?: string | null
}

export type FilteredInboundAttachment = {
  originalFileName: string
  sanitizedFileName: string
  mimeType: string
  fileSize: number
  bytes: Uint8Array
}

export type RejectedInboundAttachment = {
  originalFileName: string
  reason: string
}

export function sanitizeInboundFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop()?.trim() || 'document'
  return base.replace(/[^\w.-]+/g, '_').slice(0, 120) || 'document'
}

function extensionOf(fileName: string) {
  const parts = fileName.toLowerCase().split('.')
  if (parts.length < 2) return ''
  return parts.at(-1) ?? ''
}

function normalizeMime(mimeType: string | null | undefined, fileName: string) {
  const raw = (mimeType || '').split(';')[0]?.trim().toLowerCase() || ''
  if (
    raw &&
    INBOUND_ACCEPTED_MIME_TYPES.includes(
      raw as (typeof INBOUND_ACCEPTED_MIME_TYPES)[number],
    )
  ) {
    return raw === 'image/jpg' ? 'image/jpeg' : raw
  }
  switch (extensionOf(fileName)) {
    case 'pdf':
      return 'application/pdf'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'heic':
      return 'image/heic'
    case 'heif':
      return 'image/heif'
    default:
      return raw
  }
}

function isAcceptedType(mimeType: string, fileName: string) {
  if (
    INBOUND_ACCEPTED_MIME_TYPES.includes(
      mimeType as (typeof INBOUND_ACCEPTED_MIME_TYPES)[number],
    )
  ) {
    return true
  }
  return ACCEPTED_EXTENSIONS.has(extensionOf(fileName))
}

function isJunkFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop()?.trim() || ''
  const withoutExt = base.replace(/\.[^.]+$/, '')
  return JUNK_NAME_PATTERN.test(withoutExt)
}

function decodeBase64(content: string) {
  const cleaned = content.replace(/\s/g, '')
  const buffer = Buffer.from(cleaned, 'base64')
  if (buffer.length === 0 && cleaned.length > 0) {
    throw new Error('invalid_base64')
  }
  return new Uint8Array(buffer)
}

export function inspectInboundAttachment(attachment: InboundAttachmentInput): {
  accepted?: FilteredInboundAttachment
  rejected?: RejectedInboundAttachment
} {
  const originalFileName = attachment.name?.trim() || 'attachment'
  const mimeType = normalizeMime(attachment.contentType, originalFileName)
  if (!isAcceptedType(mimeType, originalFileName)) {
    return { rejected: { originalFileName, reason: 'unsupported_type' } }
  }

  if (isJunkFileName(originalFileName)) {
    return { rejected: { originalFileName, reason: 'junk_filename' } }
  }

  if (!attachment.content) {
    return { rejected: { originalFileName, reason: 'missing_content' } }
  }

  let bytes: Uint8Array
  try {
    bytes = decodeBase64(attachment.content)
  } catch {
    return { rejected: { originalFileName, reason: 'invalid_content' } }
  }

  const fileSize = bytes.byteLength
  const minBytes =
    mimeType === 'application/pdf' ? INBOUND_MIN_PDF_BYTES : INBOUND_MIN_IMAGE_BYTES
  if (fileSize < minBytes) {
    return { rejected: { originalFileName, reason: 'too_small' } }
  }
  if (fileSize > INBOUND_MAX_FILE_BYTES) {
    return { rejected: { originalFileName, reason: 'too_large' } }
  }
  if (attachment.contentLength && attachment.contentLength > INBOUND_MAX_FILE_BYTES) {
    return { rejected: { originalFileName, reason: 'too_large' } }
  }

  return {
    accepted: {
      originalFileName,
      sanitizedFileName: sanitizeInboundFileName(originalFileName),
      mimeType,
      fileSize,
      bytes,
    },
  }
}

export function filterInboundAttachments(attachments: InboundAttachmentInput[]) {
  const accepted: FilteredInboundAttachment[] = []
  const rejected: RejectedInboundAttachment[] = []
  for (const attachment of attachments) {
    const result = inspectInboundAttachment(attachment)
    if (result.accepted) accepted.push(result.accepted)
    if (result.rejected) rejected.push(result.rejected)
  }
  return { accepted, rejected }
}
