import { createHmac, timingSafeEqual } from 'node:crypto'

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300

export type StripeSignatureCheck =
  | { ok: true; timestamp: number }
  | { ok: false; reason: 'missing_header' | 'malformed' | 'expired' | 'mismatch' }

/** parse `t=...,v1=...,v1=...` into its parts; unknown schemes are ignored */
export function parseStripeSignatureHeader(header: string | null | undefined) {
  if (!header) return null
  let timestamp: number | null = null
  const signatures: string[] = []
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2)
    if (!key || value === undefined) continue
    if (key === 't') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) timestamp = parsed
    } else if (key === 'v1') {
      signatures.push(value)
    }
  }
  if (timestamp === null || signatures.length === 0) return null
  return { timestamp, signatures }
}

export function computeStripeSignature(
  timestamp: number,
  rawBody: string,
  secret: string,
) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
}

/**
 * stripe signs `${t}.${rawBody}` with the endpoint secret. we accept any v1
 * signature in the header (secret rotation sends two) inside the tolerance.
 */
export function verifyStripeSignature(input: {
  rawBody: string
  header: string | null | undefined
  secret: string
  toleranceSeconds?: number
  nowSeconds?: number
}): StripeSignatureCheck {
  if (!input.header) return { ok: false, reason: 'missing_header' }
  const parsed = parseStripeSignatureHeader(input.header)
  if (!parsed) return { ok: false, reason: 'malformed' }

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const tolerance = input.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS
  if (Math.abs(now - parsed.timestamp) > tolerance)
    return { ok: false, reason: 'expired' }

  const expected = Buffer.from(
    computeStripeSignature(parsed.timestamp, input.rawBody, input.secret),
    'hex',
  )
  const matched = parsed.signatures.some((candidate) => {
    if (!/^[0-9a-f]+$/i.test(candidate)) return false
    const provided = Buffer.from(candidate, 'hex')
    return provided.length === expected.length && timingSafeEqual(provided, expected)
  })
  return matched
    ? { ok: true, timestamp: parsed.timestamp }
    : { ok: false, reason: 'mismatch' }
}

/** build a header the way stripe does; used by tests and local tooling */
export function buildStripeSignatureHeader(
  rawBody: string,
  secret: string,
  timestamp: number,
) {
  return `t=${timestamp},v1=${computeStripeSignature(timestamp, rawBody, secret)}`
}
