import { describe, expect, it } from 'vitest'

import {
  decryptNino,
  encryptNino,
  isEncryptedSecretPayload,
  ninoLast4,
  normalizeNino,
} from '~/features/hmrc/server/crypto'

describe('nino crypto', () => {
  it('encrypts and decrypts a nino', () => {
    const nino = normalizeNino('QQ 123456 C')
    const encrypted = encryptNino(nino)
    expect(isEncryptedSecretPayload(encrypted)).toBe(true)
    expect(decryptNino(encrypted)).toBe(nino)
    expect(ninoLast4(decryptNino(encrypted))).toBe('456C')
  })

  it('reads legacy plaintext ninos', () => {
    expect(decryptNino('QQ123456C')).toBe('QQ123456C')
  })
})
