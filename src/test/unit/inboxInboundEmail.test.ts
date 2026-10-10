import { describe, expect, it } from 'vitest'

import {
  filterInboundAttachments,
  inspectInboundAttachment,
  sanitizeInboundFileName,
} from '~/features/inbox/filterAttachments'
import { formatInboxReceivedAt } from '~/features/inbox/formatInboxReceivedAt'
import {
  buildInboundEmailAddress,
  generateInboundToken,
  INBOUND_TOKEN_LENGTH,
  isInboundToken,
  parseInboundRecipientToken,
} from '~/features/inbox/inboundToken'
import {
  resolvePostmarkFromAddress,
  resolvePostmarkRecipientToken,
} from '~/features/inbox/postmarkPayload'
import { sha256Hex } from '~/features/inbox/sha256'
import {
  parseBasicAuthHeader,
  verifyWebhookBasicAuth,
} from '~/features/inbox/webhookAuth'

const DOMAIN = 'inbox.straightup.tax'

function pdfBase64(size = 12_000) {
  return Buffer.alloc(size, 1).toString('base64')
}

function imageBase64(size = 12_000) {
  return Buffer.alloc(size, 2).toString('base64')
}

describe('inbound token', () => {
  it('generates a cryptographically random email-safe token', () => {
    const token = generateInboundToken()
    expect(token).toHaveLength(INBOUND_TOKEN_LENGTH)
    expect(isInboundToken(token)).toBe(true)
    expect(token).not.toMatch(/[A-Z]/)
    expect(buildInboundEmailAddress(token, DOMAIN)).toBe(`${token}@${DOMAIN}`)
  })

  it('retries uniqueness by generating distinct tokens', () => {
    const tokens = new Set(Array.from({ length: 40 }, () => generateInboundToken()))
    expect(tokens.size).toBe(40)
  })

  it('parses a valid recipient token', () => {
    const token = '7fk2q9xmab12'
    expect(parseInboundRecipientToken(`${token}@${DOMAIN}`, DOMAIN)).toBe(token)
    expect(parseInboundRecipientToken(`Builder Ltd <${token}@${DOMAIN}>`, DOMAIN)).toBe(
      token,
    )
  })

  it('rejects the wrong domain', () => {
    expect(parseInboundRecipientToken('7fk2q9xmab12@gmail.com', DOMAIN)).toBeNull()
  })

  it('rejects an invalid token', () => {
    expect(parseInboundRecipientToken(`customer123@${DOMAIN}`, DOMAIN)).toBeNull()
    expect(parseInboundRecipientToken(`userid547@${DOMAIN}`, DOMAIN)).toBeNull()
    expect(parseInboundRecipientToken(`tim.neale@${DOMAIN}`, DOMAIN)).toBeNull()
  })
})

describe('postmark recipient routing', () => {
  it('uses OriginalRecipient then To, never From', () => {
    const token = '7fk2q9xmab12'
    const resolved = resolvePostmarkRecipientToken(
      {
        From: 'supplier@example.com',
        OriginalRecipient: `${token}@${DOMAIN}`,
        To: 'other@example.com',
        MessageID: 'msg-1',
      },
      DOMAIN,
    )
    expect(resolved?.token).toBe(token)
    expect(resolvePostmarkFromAddress({ From: 'supplier@example.com' })).toBe(
      'supplier@example.com',
    )
  })

  it('ignores a revoked-style lookup by only parsing active token format', () => {
    expect(
      resolvePostmarkRecipientToken(
        { To: `not-a-token@${DOMAIN}`, MessageID: 'msg-2' },
        DOMAIN,
      ),
    ).toBeNull()
  })
})

describe('attachment filtering', () => {
  it('accepts a pdf', () => {
    const result = inspectInboundAttachment({
      name: 'receipt-1427.pdf',
      contentType: 'application/pdf',
      content: pdfBase64(),
    })
    expect(result.accepted?.mimeType).toBe('application/pdf')
    expect(result.accepted?.sanitizedFileName).toBe('receipt-1427.pdf')
  })

  it('accepts multiple valid attachments', () => {
    const { accepted, rejected } = filterInboundAttachments([
      {
        name: 'receipt.pdf',
        contentType: 'application/pdf',
        content: pdfBase64(),
      },
      {
        name: 'invoice.jpg',
        contentType: 'image/jpeg',
        content: imageBase64(),
      },
    ])
    expect(accepted).toHaveLength(2)
    expect(rejected).toHaveLength(0)
  })

  it('ignores signature and logo images', () => {
    const { accepted, rejected } = filterInboundAttachments([
      {
        name: 'signature.jpg',
        contentType: 'image/jpeg',
        content: imageBase64(),
      },
      {
        name: 'logo.png',
        contentType: 'image/png',
        content: imageBase64(),
        contentId: '',
      },
      {
        name: 'facebook-icon.png',
        contentType: 'image/png',
        content: imageBase64(),
      },
    ])
    expect(accepted).toHaveLength(0)
    expect(rejected.map((item) => item.reason)).toEqual([
      'junk_filename',
      'junk_filename',
      'junk_filename',
    ])
  })

  it('accepts camera jpegs that mail clients stamp with a content id', () => {
    const result = inspectInboundAttachment({
      name: 'IMG_7611.jpeg',
      contentType: 'image/jpeg',
      content: imageBase64(),
      contentId: 'ii_abc123',
    })
    expect(result.accepted?.mimeType).toBe('image/jpeg')
  })

  it('accepts pdfs that mail clients stamp with a content id', () => {
    const result = inspectInboundAttachment({
      name: 'Tim_Neale_Invoice_1479_August_2026.pdf',
      contentType: 'application/pdf',
      content: pdfBase64(),
      contentId: 'f_abc123',
    })
    expect(result.accepted?.mimeType).toBe('application/pdf')
  })

  it('rejects unsupported attachments', () => {
    const result = inspectInboundAttachment({
      name: 'notes.txt',
      contentType: 'text/plain',
      content: Buffer.alloc(12_000, 3).toString('base64'),
    })
    expect(result.rejected?.reason).toBe('unsupported_type')
  })

  it('rejects tiny spacer images and oversized files', () => {
    expect(
      inspectInboundAttachment({
        name: 'spacer.gif',
        contentType: 'image/gif',
        content: Buffer.alloc(80, 4).toString('base64'),
      }).rejected?.reason,
    ).toBe('unsupported_type')

    expect(
      inspectInboundAttachment({
        name: 'tiny.png',
        contentType: 'image/png',
        content: Buffer.alloc(100, 5).toString('base64'),
      }).rejected?.reason,
    ).toBe('too_small')

    expect(
      inspectInboundAttachment({
        name: 'invoice.pdf',
        contentType: 'application/pdf',
        content: pdfBase64(4_000),
      }).accepted?.mimeType,
    ).toBe('application/pdf')

    expect(
      inspectInboundAttachment({
        name: 'huge.pdf',
        contentType: 'application/pdf',
        content: Buffer.alloc(11 * 1024 * 1024, 6).toString('base64'),
      }).rejected?.reason,
    ).toBe('too_large')
  })

  it('sanitises filenames and never trusts path segments', () => {
    expect(sanitizeInboundFileName('../../etc/passwd.pdf')).toBe('passwd.pdf')
    expect(sanitizeInboundFileName('CIS July (final).pdf')).toBe('CIS_July_final_.pdf')
  })
})

describe('duplicate detection', () => {
  it('hashes by content not filename', () => {
    const bytes = new Uint8Array(Buffer.alloc(100, 9))
    const hash = sha256Hex(bytes)
    expect(sha256Hex(bytes)).toBe(hash)
    expect(sha256Hex(new Uint8Array(Buffer.alloc(100, 8)))).not.toBe(hash)
  })

  it('same bytes are the same hash for different accounts to compare independently', () => {
    const hash = sha256Hex(new Uint8Array([1, 2, 3, 4]))
    const accountA = { userId: 'user-a', hash }
    const accountB = { userId: 'user-b', hash }
    expect(accountA.hash).toBe(accountB.hash)
    expect(accountA.userId).not.toBe(accountB.userId)
  })
})

describe('webhook basic auth', () => {
  it('accepts the configured credentials', () => {
    const header = `Basic ${Buffer.from('postmark:secret').toString('base64')}`
    expect(verifyWebhookBasicAuth(header, 'postmark', 'secret')).toBe(true)
  })

  it('rejects missing or wrong credentials', () => {
    expect(verifyWebhookBasicAuth(null, 'postmark', 'secret')).toBe(false)
    expect(verifyWebhookBasicAuth('Bearer abc', 'postmark', 'secret')).toBe(false)
    const header = `Basic ${Buffer.from('postmark:wrong').toString('base64')}`
    expect(verifyWebhookBasicAuth(header, 'postmark', 'secret')).toBe(false)
    expect(verifyWebhookBasicAuth(header, '', '')).toBe(false)
  })

  it('parses user:password with extra colons', () => {
    const header = `Basic ${Buffer.from('user:p:ass').toString('base64')}`
    expect(parseBasicAuthHeader(header)).toEqual({ user: 'user', password: 'p:ass' })
  })
})

describe('inbox received date', () => {
  it('formats today, yesterday, and older dates', () => {
    const now = new Date('2026-08-17T12:00:00')
    expect(formatInboxReceivedAt('2026-08-17T09:42:00', now)).toBe('Today · 09:42')
    expect(formatInboxReceivedAt('2026-08-16T16:10:00', now)).toBe('Yesterday · 16:10')
    expect(formatInboxReceivedAt('2026-08-14T10:00:00', now)).toBe('14 August')
  })
})
