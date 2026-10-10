import { isIP } from 'node:net'

/**
 * basic ssrf guard for server-side fetches of user-supplied urls: only http(s),
 * no loopback / link-local / private / metadata hosts, by name or by address.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata'])
const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.localdomain',
  '.home.arpa',
]

function ipv4Octets(address: string) {
  const parts = address.split('.').map((p) => Number.parseInt(p, 10))
  return parts.length === 4 &&
    parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)
    ? (parts as [number, number, number, number])
    : null
}

function isPrivateIpv4(address: string) {
  const octets = ipv4Octets(address)
  if (!octets) return true
  const [a, b] = octets
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 192 && b === 0 && octets[2] === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true
  return false
}

function isPrivateIpv6(address: string) {
  const lower = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::' || lower === '::1') return true
  const mappedDotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mappedDotted) return isPrivateIpv4(mappedDotted[1]!)
  // url parsing rewrites ::ffff:127.0.0.1 as ::ffff:7f00:1
  const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (mappedHex) {
    const hi = Number.parseInt(mappedHex[1]!, 16)
    const lo = Number.parseInt(mappedHex[2]!, 16)
    return isPrivateIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`)
  }
  const head = Number.parseInt(lower.split(':')[0] || '0', 16)
  if (Number.isNaN(head)) return true
  if ((head & 0xfe00) === 0xfc00) return true
  if ((head & 0xffc0) === 0xfe80) return true
  if ((head & 0xffc0) === 0xfec0) return true
  if ((head & 0xff00) === 0xff00) return true
  return false
}

/** true for any address a server must never be made to call */
export function isPrivateAddress(address: string) {
  const version = isIP(address.replace(/^\[|\]$/g, ''))
  if (version === 4) return isPrivateIpv4(address)
  if (version === 6) return isPrivateIpv6(address)
  return true
}

export function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return true
  if (BLOCKED_HOSTNAMES.has(host)) return true
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true
  if (isIP(host.replace(/^\[|\]$/g, ''))) return isPrivateAddress(host)
  if (!host.includes('.')) return true
  return false
}

/** parses and validates a user-supplied url; throws UnsafeUrlError */
export function assertSafeUrl(input: string) {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new UnsafeUrlError('Invalid url')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http and https urls are allowed')
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('Urls with credentials are not allowed')
  }
  if (isBlockedHostname(url.hostname)) {
    throw new UnsafeUrlError('Host is not allowed')
  }
  return url
}
