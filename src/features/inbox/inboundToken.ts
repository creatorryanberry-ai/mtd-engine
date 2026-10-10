const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
export const INBOUND_TOKEN_LENGTH = 12
export const INBOUND_TOKEN_PATTERN = /^[a-z0-9]{12}$/

export function generateInboundToken(length = INBOUND_TOKEN_LENGTH) {
  const out: string[] = []
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - out.length))
    for (const byte of bytes) {
      // 252 is the largest multiple of 36 that fits in a byte
      if (byte >= 252) continue
      out.push(TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]!)
      if (out.length === length) break
    }
  }
  return out.join('')
}

export function isInboundToken(value: string) {
  return INBOUND_TOKEN_PATTERN.test(value)
}

export function buildInboundEmailAddress(token: string, domain: string) {
  return `${token}@${domain.toLowerCase()}`
}

function extractEmails(raw: string) {
  const emails: string[] = []
  const angle = /<([^>]+)>/g
  let match = angle.exec(raw)
  while (match) {
    emails.push(match[1]!.trim())
    match = angle.exec(raw)
  }
  if (emails.length === 0) {
    for (const part of raw.split(',')) {
      const value = part.trim()
      if (value.includes('@')) emails.push(value)
    }
  }
  return emails
}

export function parseInboundRecipientToken(
  rawRecipient: string,
  domain: string,
): string | null {
  const expectedDomain = domain.toLowerCase()
  for (const email of extractEmails(rawRecipient)) {
    const at = email.lastIndexOf('@')
    if (at <= 0) continue
    const local = email.slice(0, at).trim().toLowerCase()
    const host = email
      .slice(at + 1)
      .trim()
      .toLowerCase()
    if (host !== expectedDomain) continue
    if (!isInboundToken(local)) continue
    return local
  }
  return null
}
