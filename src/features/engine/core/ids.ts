import { createHash, randomUUID } from 'node:crypto'

/** prefixed uuid so ids are greppable: ws_..., ct_..., ord_... */
export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

/** stable 0..9999 bucket from any identifier; used for deterministic holdouts */
export function hashBucket(value: string, salt = '') {
  const digest = createHash('sha256').update(`${salt}:${value}`).digest()
  return digest.readUInt32BE(0) % 10_000
}

export function normalizeEmail(email: string | null | undefined) {
  if (!email) return null
  const trimmed = email.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : null
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
