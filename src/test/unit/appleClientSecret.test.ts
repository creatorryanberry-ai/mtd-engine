import { decodeJwt, decodeProtectedHeader, exportPKCS8, generateKeyPair } from 'jose'
import { describe, expect, it } from 'vitest'

import {
  generateAppleClientSecret,
  normalizeApplePrivateKey,
} from '~/features/auth/server/appleClientSecret'

describe('generateAppleClientSecret', () => {
  it('mints a jwt with apple claims', async () => {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true })
    const pem = await exportPKCS8(privateKey)
    const token = await generateAppleClientSecret({
      clientId: 'com.example.si',
      teamId: 'TEAM123',
      keyId: 'KEY456',
      privateKey: pem,
    })

    const header = decodeProtectedHeader(token)
    const payload = decodeJwt(token)

    expect(header.alg).toBe('ES256')
    expect(header.kid).toBe('KEY456')
    expect(payload.iss).toBe('TEAM123')
    expect(payload.sub).toBe('com.example.si')
    expect(payload.aud).toBe('https://appleid.apple.com')
  })
})

describe('normalizeApplePrivateKey', () => {
  it('converts literal newlines in PEM values', () => {
    expect(
      normalizeApplePrivateKey(
        '-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----',
      ),
    ).toBe('-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----')
  })
})
