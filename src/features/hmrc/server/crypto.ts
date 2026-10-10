import { createHash, randomBytes } from 'node:crypto'

import { encryptSecret, decryptSecret } from '~/server/encryption'

export function encryptHmrcToken(token: string) {
  return encryptSecret(token)
}

export function decryptHmrcToken(payload: string) {
  return decryptSecret(payload)
}

export function encryptNino(nino: string) {
  return encryptSecret(normalizeNino(nino))
}

/** accepts legacy plaintext NINOs until backfill completes */
export function decryptNino(value: string) {
  if (isEncryptedSecretPayload(value)) {
    return normalizeNino(decryptSecret(value))
  }
  return normalizeNino(value)
}

export function isEncryptedSecretPayload(value: string) {
  const parts = value.split(':')
  return parts.length === 3 && parts.every((part) => part.length > 0)
}

export function createPkcePair() {
  const codeVerifier = randomBytes(32).toString('base64url')
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
  return { codeVerifier, codeChallenge }
}

export function createOAuthState() {
  return randomBytes(24).toString('base64url')
}

const NINO_PATTERN = /^[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[A-D]{1}$/i

export function normalizeNino(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function isValidNino(value: string) {
  return NINO_PATTERN.test(normalizeNino(value))
}

export function ninoLast4(nino: string) {
  const normalized = normalizeNino(nino)
  return normalized.slice(-4)
}
