import { timingSafeEqual } from 'node:crypto'

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value)
}

export function timingSafeEqualString(left: string, right: string) {
  const leftBytes = encodeUtf8(left)
  const rightBytes = encodeUtf8(right)
  const length = Math.max(leftBytes.length, rightBytes.length)
  const paddedLeft = new Uint8Array(length)
  const paddedRight = new Uint8Array(length)
  paddedLeft.set(leftBytes)
  paddedRight.set(rightBytes)
  const match = timingSafeEqual(paddedLeft, paddedRight)
  return match && leftBytes.length === rightBytes.length
}

export function parseBasicAuthHeader(header: string | null | undefined) {
  if (!header) return null
  const [scheme, encoded] = header.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'basic' || !encoded) return null
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8')
    const separator = decoded.indexOf(':')
    if (separator < 0) return null
    return {
      user: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    }
  } catch {
    return null
  }
}

export function verifyWebhookBasicAuth(
  header: string | null | undefined,
  expectedUser: string,
  expectedPassword: string,
) {
  if (!expectedUser || !expectedPassword) return false
  const parsed = parseBasicAuthHeader(header)
  if (!parsed) return false
  return (
    timingSafeEqualString(parsed.user, expectedUser) &&
    timingSafeEqualString(parsed.password, expectedPassword)
  )
}
